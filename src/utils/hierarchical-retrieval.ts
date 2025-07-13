import { AvenKnowledgeItem } from '@/types'
import { addToKnowledgeBase } from '@/lib/pinecone'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Hierarchical Retrieval System
 * Based on the pattern from your knowledge: "take every file and write a one line summary"
 * Creates multiple levels of granularity for better retrieval
 */

interface HierarchicalDocument {
  id: string
  title: string
  summary: string
  content: string
  url: string
  category: string
  chunks: DocumentChunk[]
}

interface DocumentChunk {
  id: string
  parentId: string
  content: string
  summary: string
  position: number
}

export class HierarchicalRetrieval {
  
  /**
   * Process documents into hierarchical structure:
   * 1. Document-level summary
   * 2. Chunk-level summaries  
   * 3. Store both levels in vector DB
   */
  async processDocument(item: AvenKnowledgeItem): Promise<void> {
    console.log(`📊 Processing hierarchical structure for: ${item.title}`)

    // Step 1: Generate document-level summary
    const documentSummary = await this.generateDocumentSummary(item)
    
    // Step 2: Create chunks with summaries
    const chunks = await this.createSmartChunks(item)
    
    // Step 3: Store document summary in vector DB
    const summaryDoc: AvenKnowledgeItem = {
      id: `${item.id}-summary`,
      title: `[Summary] ${item.title}`,
      content: documentSummary,
      url: item.url,
      category: item.category
    }
    
    await addToKnowledgeBase(summaryDoc)
    console.log(`✅ Added document summary: ${summaryDoc.id}`)

    // Step 4: Store chunk summaries
    for (const chunk of chunks) {
      const chunkDoc: AvenKnowledgeItem = {
        id: chunk.id,
        title: `${item.title} - Part ${chunk.position}`,
        content: `Summary: ${chunk.summary}\n\nContent: ${chunk.content}`,
        url: item.url,
        category: item.category
      }
      
      await addToKnowledgeBase(chunkDoc)
      console.log(`✅ Added chunk ${chunk.position}: ${chunk.id}`)
    }
  }

  private async generateDocumentSummary(item: AvenKnowledgeItem): Promise<string> {
    const prompt = `Create a comprehensive summary of this Aven document that captures all key information.

Title: ${item.title}
Content: ${item.content}

Create a detailed summary that includes:
1. Main topic/purpose
2. Key facts, numbers, and details
3. Important features or requirements
4. Any specific processes or steps mentioned

The summary should be comprehensive enough that someone could understand the document's content without reading the original.`

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 500,
      })

      return response.choices[0]?.message?.content?.trim() || item.content.substring(0, 500)
    } catch (error) {
      console.error('Error generating document summary:', error)
      return item.content.substring(0, 500)
    }
  }

  private async createSmartChunks(item: AvenKnowledgeItem): Promise<DocumentChunk[]> {
    const maxChunkSize = 800 // Smaller chunks for better granularity
    const content = item.content
    
    if (content.length <= maxChunkSize) {
      // Document is small enough, create one chunk
      const summary = await this.generateChunkSummary(content, 1, item.title)
      return [{
        id: `${item.id}-chunk-1`,
        parentId: item.id,
        content,
        summary,
        position: 1
      }]
    }

    // Split into semantic chunks (by sentences/paragraphs)
    const chunks = this.splitIntoSemanticChunks(content, maxChunkSize)
    const processedChunks: DocumentChunk[] = []

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const summary = await this.generateChunkSummary(chunk, i + 1, item.title)
      
      processedChunks.push({
        id: `${item.id}-chunk-${i + 1}`,
        parentId: item.id,
        content: chunk,
        summary,
        position: i + 1
      })
    }

    return processedChunks
  }

  private splitIntoSemanticChunks(content: string, maxSize: number): string[] {
    // Split by paragraphs first, then by sentences if needed
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0)
    const chunks: string[] = []
    let currentChunk = ''

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length <= maxSize) {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim())
          currentChunk = paragraph
        } else {
          // Paragraph is too long, split by sentences
          const sentences = paragraph.split(/[.!?]+/).filter(s => s.trim().length > 0)
          let sentenceChunk = ''
          
          for (const sentence of sentences) {
            if (sentenceChunk.length + sentence.length <= maxSize) {
              sentenceChunk += (sentenceChunk ? '. ' : '') + sentence.trim()
            } else {
              if (sentenceChunk) {
                chunks.push(sentenceChunk + '.')
                sentenceChunk = sentence.trim()
              } else {
                // Sentence too long, just truncate
                chunks.push(sentence.substring(0, maxSize))
              }
            }
          }
          
          if (sentenceChunk) {
            currentChunk = sentenceChunk + '.'
          }
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim())
    }

    return chunks.filter(chunk => chunk.length > 50) // Filter very small chunks
  }

  private async generateChunkSummary(chunkContent: string, position: number, documentTitle: string): Promise<string> {
    const prompt = `Create a concise summary of this content chunk from "${documentTitle}".

Chunk ${position} Content:
${chunkContent}

Create a 1-2 sentence summary that captures the main point of this specific section. Focus on what makes this chunk unique within the larger document.`

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 100,
      })

      return response.choices[0]?.message?.content?.trim() || `Section ${position} of ${documentTitle}`
    } catch (error) {
      console.error('Error generating chunk summary:', error)
      return `Section ${position} of ${documentTitle}`
    }
  }

  /**
   * Enhanced search that uses hierarchical structure
   */
  async hierarchicalSearch(query: string, searchKnowledgeBase: (q: string) => Promise<AvenKnowledgeItem[]>): Promise<AvenKnowledgeItem[]> {
    console.log(`🔍 Hierarchical search for: "${query}"`)

    // Step 1: Search summaries first (faster, higher level)
    const summaryResults = await searchKnowledgeBase(`[Summary] ${query}`)
    
    // Step 2: Search detailed content
    const contentResults = await searchKnowledgeBase(query)
    
    // Step 3: If we found good summaries, get their detailed chunks
    const enhancedResults: AvenKnowledgeItem[] = []
    
    for (const summary of summaryResults.slice(0, 2)) {
      // Get the parent document ID
      const parentId = summary.id.replace('-summary', '')
      
      // Find chunks from the same document
      const relatedChunks = contentResults.filter(r => 
        r.id.startsWith(parentId) && r.id.includes('-chunk-')
      )
      
      // Add summary first, then best chunks
      enhancedResults.push(summary)
      enhancedResults.push(...relatedChunks.slice(0, 2))
    }

    // Add any remaining content results
    const remainingResults = contentResults.filter(r => 
      !enhancedResults.some(er => er.id === r.id)
    )
    
    enhancedResults.push(...remainingResults.slice(0, 3))

    return enhancedResults.slice(0, 5) // Return top 5 results
  }

  /**
   * Batch process multiple documents
   */
  async batchProcessDocuments(items: AvenKnowledgeItem[]): Promise<void> {
    console.log(`📊 Batch processing ${items.length} documents for hierarchical retrieval`)
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      console.log(`Processing ${i + 1}/${items.length}: ${item.title}`)
      
      try {
        await this.processDocument(item)
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        console.error(`Error processing ${item.id}:`, error)
        continue
      }
    }
    
    console.log(`✅ Completed batch processing of ${items.length} documents`)
  }
}

export const hierarchicalRetrieval = new HierarchicalRetrieval()