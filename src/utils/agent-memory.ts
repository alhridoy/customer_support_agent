import { AvenKnowledgeItem } from '@/types'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Agent Memory & Semantic Caching
 * Based on: "memories are personalization, but they're also like a semantic cache 
 * that speeds up future runs"
 */

interface Memory {
  id: string
  type: 'search_pattern' | 'user_context' | 'domain_knowledge' | 'conversation'
  content: string
  metadata: MemoryMetadata
  embedding?: number[]
  createdAt: Date
  lastAccessed: Date
  accessCount: number
}

interface MemoryMetadata {
  userId?: string
  category: string
  topics: string[]
  confidence: number
  source: string
}

interface SemanticCache {
  query: string
  results: AvenKnowledgeItem[]
  timestamp: Date
  hitCount: number
  queryEmbedding: number[]
}

export class AgentMemory {
  private memories: Map<string, Memory> = new Map()
  private semanticCache: Map<string, SemanticCache> = new Map()
  private maxMemories = 1000
  private cacheHitThreshold = 0.85 // Cosine similarity threshold
  
  /**
   * MEMORY TOOLS - as suggested: "You add a tool that saves memories. Then you add a tool that reads memories"
   */
  
  async saveMemory(content: string, type: Memory['type'], metadata: Partial<MemoryMetadata>): Promise<string> {
    const memoryId = `memory-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
    
    const memory: Memory = {
      id: memoryId,
      type,
      content,
      metadata: {
        category: metadata.category || 'general',
        topics: metadata.topics || [],
        confidence: metadata.confidence || 0.8,
        source: metadata.source || 'system',
        ...metadata
      },
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 1
    }

    // Generate embedding for semantic search
    try {
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: content,
        dimensions: 1024,
      })
      memory.embedding = embeddingResponse.data[0].embedding
    } catch (error) {
      console.error('Error generating memory embedding:', error)
    }

    this.memories.set(memoryId, memory)
    
    // Cleanup old memories if we exceed limit
    if (this.memories.size > this.maxMemories) {
      this.cleanupOldMemories()
    }
    
    console.log(`💾 Saved memory: ${type} - ${content.substring(0, 50)}...`)
    return memoryId
  }

  async readMemories(query: string, type?: Memory['type'], limit: number = 5): Promise<Memory[]> {
    let relevantMemories = Array.from(this.memories.values())
    
    // Filter by type if specified
    if (type) {
      relevantMemories = relevantMemories.filter(m => m.type === type)
    }

    // Generate query embedding for semantic search
    let queryEmbedding: number[] = []
    try {
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
        dimensions: 1024,
      })
      queryEmbedding = embeddingResponse.data[0].embedding
    } catch (error) {
      console.error('Error generating query embedding for memory search:', error)
      // Fallback to keyword search
      return this.keywordSearchMemories(query, relevantMemories, limit)
    }

    // Calculate similarity scores
    const memoryScores = relevantMemories
      .filter(memory => memory.embedding)
      .map(memory => ({
        memory,
        similarity: this.cosineSimilarity(queryEmbedding, memory.embedding!)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)

    // Update access tracking
    memoryScores.forEach(({ memory }) => {
      memory.lastAccessed = new Date()
      memory.accessCount++
    })

    console.log(`🔍 Found ${memoryScores.length} relevant memories for: "${query}"`)
    return memoryScores.map(({ memory }) => memory)
  }

  /**
   * SEMANTIC CACHING - Speed up repeated searches
   */
  
  async checkSemanticCache(query: string): Promise<AvenKnowledgeItem[] | null> {
    // Generate query embedding
    let queryEmbedding: number[]
    try {
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
        dimensions: 1024,
      })
      queryEmbedding = embeddingResponse.data[0].embedding
    } catch (error) {
      console.error('Error generating embedding for cache check:', error)
      return null
    }

    // Check for similar cached queries
    for (const [cacheKey, cacheEntry] of this.semanticCache.entries()) {
      const similarity = this.cosineSimilarity(queryEmbedding, cacheEntry.queryEmbedding)
      
      if (similarity > this.cacheHitThreshold) {
        cacheEntry.hitCount++
        console.log(`⚡ Cache hit for "${query}" (similarity: ${similarity.toFixed(3)})`)
        return cacheEntry.results
      }
    }

    return null
  }

  async addToSemanticCache(query: string, results: AvenKnowledgeItem[]): Promise<void> {
    try {
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
        dimensions: 1024,
      })

      const cacheKey = `cache-${Date.now()}`
      const cacheEntry: SemanticCache = {
        query,
        results,
        timestamp: new Date(),
        hitCount: 0,
        queryEmbedding: embeddingResponse.data[0].embedding
      }

      this.semanticCache.set(cacheKey, cacheEntry)
      
      // Cleanup old cache entries (keep 100 most recent)
      if (this.semanticCache.size > 100) {
        const entries = Array.from(this.semanticCache.entries())
        entries.sort((a, b) => b[1].timestamp.getTime() - a[1].timestamp.getTime())
        
        // Keep top 100, remove rest
        for (let i = 100; i < entries.length; i++) {
          this.semanticCache.delete(entries[i][0])
        }
      }

      console.log(`💾 Added to semantic cache: "${query}"`)
    } catch (error) {
      console.error('Error adding to semantic cache:', error)
    }
  }

  /**
   * CONTEXTUAL MEMORY - Learn from user interactions
   */
  
  async learnFromInteraction(
    userQuery: string, 
    agentResponse: string, 
    searchResults: AvenKnowledgeItem[],
    userId?: string
  ): Promise<void> {
    // Save search pattern
    if (searchResults.length > 0) {
      const searchPattern = `Query: "${userQuery}" found ${searchResults.length} results about ${searchResults[0].category}`
      await this.saveMemory(searchPattern, 'search_pattern', {
        userId,
        category: searchResults[0].category,
        topics: searchResults.map(r => r.category),
        confidence: 0.9,
        source: 'user_interaction'
      })
    }

    // Extract domain knowledge from successful interactions
    if (searchResults.length > 0) {
      const domainKnowledge = `Customers asking about "${userQuery}" are typically interested in: ${searchResults.map(r => r.title).join(', ')}`
      await this.saveMemory(domainKnowledge, 'domain_knowledge', {
        userId,
        category: 'customer_patterns',
        topics: [userQuery.toLowerCase()],
        confidence: 0.8,
        source: 'interaction_analysis'
      })
    }
  }

  /**
   * RETRIEVAL ENHANCEMENT - Use memories to improve search
   */
  
  async enhanceQuery(originalQuery: string, userId?: string): Promise<string> {
    // Look for relevant memories
    const relevantMemories = await this.readMemories(originalQuery, 'search_pattern', 3)
    
    if (relevantMemories.length === 0) {
      return originalQuery
    }

    // Use LLM to enhance the query based on memory
    const memoryContext = relevantMemories
      .map(m => m.content)
      .join('\n')

    const prompt = `Based on previous successful searches, enhance this query for better results.

Original Query: "${originalQuery}"

Similar Past Searches:
${memoryContext}

Generate an enhanced query that incorporates learnings from past successful searches. Keep it concise and focused.`

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 100,
      })

      const enhancedQuery = response.choices[0]?.message?.content?.trim() || originalQuery
      console.log(`🧠 Enhanced query: "${originalQuery}" → "${enhancedQuery}"`)
      return enhancedQuery
    } catch (error) {
      console.error('Error enhancing query with memory:', error)
      return originalQuery
    }
  }

  /**
   * UTILITY METHODS
   */
  
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0
    
    let dotProduct = 0
    let normA = 0
    let normB = 0
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  private keywordSearchMemories(query: string, memories: Memory[], limit: number): Memory[] {
    const queryLower = query.toLowerCase()
    const queryWords = queryLower.split(/\s+/)
    
    return memories
      .map(memory => {
        const contentLower = memory.content.toLowerCase()
        const matchScore = queryWords.reduce((score, word) => {
          return contentLower.includes(word) ? score + 1 : score
        }, 0) / queryWords.length
        
        return { memory, score: matchScore }
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ memory }) => memory)
  }

  private cleanupOldMemories(): void {
    const memories = Array.from(this.memories.entries())
    
    // Sort by last accessed (oldest first)
    memories.sort((a, b) => a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime())
    
    // Remove oldest 10%
    const toRemove = Math.floor(memories.length * 0.1)
    for (let i = 0; i < toRemove; i++) {
      this.memories.delete(memories[i][0])
    }
    
    console.log(`🧹 Cleaned up ${toRemove} old memories`)
  }

  /**
   * MEMORY ANALYTICS
   */
  
  getMemoryStats(): {
    totalMemories: number
    cacheSize: number
    topCategories: string[]
    cacheHitRate: number
  } {
    const memories = Array.from(this.memories.values())
    const categoryCount = new Map<string, number>()
    
    memories.forEach(memory => {
      const count = categoryCount.get(memory.metadata.category) || 0
      categoryCount.set(memory.metadata.category, count + 1)
    })
    
    const topCategories = Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category]) => category)
    
    const totalCacheHits = Array.from(this.semanticCache.values())
      .reduce((sum, cache) => sum + cache.hitCount, 0)
    
    const cacheHitRate = this.semanticCache.size > 0 ? 
      totalCacheHits / this.semanticCache.size : 0

    return {
      totalMemories: this.memories.size,
      cacheSize: this.semanticCache.size,
      topCategories,
      cacheHitRate
    }
  }
}

export const agentMemory = new AgentMemory()