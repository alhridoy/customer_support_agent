import { Pinecone } from '@pinecone-database/pinecone'
import { AvenKnowledgeItem } from '@/types'
import { pineconeConfig } from '@/config'

// Custom error classes for better error handling
export class PineconeConnectionError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message)
    this.name = 'PineconeConnectionError'
  }
}

export class PineconeQueryError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message)
    this.name = 'PineconeQueryError'
  }
}

let pinecone: Pinecone | null = null

export async function initializePinecone() {
  if (!pinecone) {
    try {
      pinecone = new Pinecone({
        apiKey: pineconeConfig.apiKey,
      })
    } catch (error) {
      throw new PineconeConnectionError(
        'Failed to initialize Pinecone client',
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  return { pinecone }
}

export async function searchKnowledgeBase(query: string): Promise<AvenKnowledgeItem[]> {
  try {
    const { pinecone: pc } = await initializePinecone()
    
    if (!pc) {
      throw new Error('Failed to initialize Pinecone')
    }

    // Get the index
    const index = pc.Index(process.env.PINECONE_INDEX_NAME || 'aven-support-index')

    // Create embedding for the query using OpenAI
    const { generateEmbedding } = await import('./openai')
    const queryEmbedding = await generateEmbedding(query)

    // Search for similar vectors
    const searchResult = await index.query({
      vector: queryEmbedding,
      topK: 5,
      includeMetadata: true,
    })

    // Convert results to AvenKnowledgeItem format
    const results: AvenKnowledgeItem[] = searchResult.matches?.map(match => ({
      id: match.id,
      title: match.metadata?.title as string || '',
      content: match.metadata?.content as string || '',
      url: match.metadata?.url as string || '',
      category: match.metadata?.category as string || 'general',
      embedding: match.values,
    })) || []

    return results
  } catch (error) {
    // Log detailed error information for debugging
    console.error('Pinecone search error details:', {
      query: query.substring(0, 100),
      topK,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    })

    // Throw specific error types for better upstream handling
    if (error instanceof Error) {
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        throw new PineconeQueryError('Rate limit exceeded, please try again later', error)
      } else if (error.message.includes('authentication') || error.message.includes('401')) {
        throw new PineconeQueryError('Authentication failed, check API key', error)
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        throw new PineconeQueryError('Network error, please try again', error)
      }
    }

    throw new PineconeQueryError('Failed to search knowledge base',
      error instanceof Error ? error : new Error(String(error))
    )
  }
}

// Function to chunk large content
function chunkContent(content: string, maxChunkSize: number = 6000): string[] {
  if (content.length <= maxChunkSize) {
    return [content]
  }

  const chunks: string[] = []
  const sentences = content.split(/[.!?]+/)
  let currentChunk = ''

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      currentChunk = sentence
    } else {
      currentChunk += sentence + '. '
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim())
  }

  return chunks.filter(chunk => chunk.length > 100) // Filter out very small chunks
}

export async function addToKnowledgeBase(item: AvenKnowledgeItem) {
  try {
    console.log(`Adding item ${item.id} to knowledge base (${item.content.length} chars)`)

    const { pinecone: pc } = await initializePinecone()

    if (!pc) {
      throw new Error('Failed to initialize Pinecone')
    }

    const index = pc.Index(process.env.PINECONE_INDEX_NAME || 'aven-support-index')
    const { generateEmbedding } = await import('./openai')

    // Chunk large content
    const chunks = chunkContent(item.content)
    console.log(`Split into ${chunks.length} chunks`)

    const upsertData = []

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const chunkId = chunks.length > 1 ? `${item.id}-chunk-${i + 1}` : item.id

      try {
        // Generate embedding for the chunk
        const embedding = await generateEmbedding(chunk)

        upsertData.push({
          id: chunkId,
          values: embedding,
          metadata: {
            title: item.title,
            content: chunk, // Store the chunk content, not full content
            url: item.url,
            category: item.category,
            chunkIndex: i + 1,
            totalChunks: chunks.length,
            contentLength: chunk.length,
          },
        })

        console.log(`✓ Prepared chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`)
      } catch (embeddingError) {
        console.error(`Error generating embedding for chunk ${i + 1}:`, embeddingError)
        continue // Skip this chunk but continue with others
      }
    }

    if (upsertData.length > 0) {
      // Upsert to Pinecone in batches
      const batchSize = 10
      for (let i = 0; i < upsertData.length; i += batchSize) {
        const batch = upsertData.slice(i, i + batchSize)
        await index.upsert(batch)
        console.log(`✓ Upserted batch ${Math.floor(i / batchSize) + 1}`)
      }

      console.log(`Successfully added item ${item.id} to knowledge base (${upsertData.length} chunks)`)
    } else {
      console.warn(`No valid chunks created for item ${item.id}`)
    }
  } catch (error) {
    console.error('Error adding to knowledge base:', error)
    throw error
  }
}
