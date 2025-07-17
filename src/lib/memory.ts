import { mem0Config } from '@/config'

// Simplified interface for MEM0 API with better type safety
interface IMemory {
  add(messages: any, options?: any): Promise<any>
  search(query: string, options?: any): Promise<any>
  get_all?(options?: any): Promise<any>
  getAll?(options?: any): Promise<any>
  delete?(memory_id: string): Promise<any>
  deleteAll?(options?: any): Promise<any>
  update?(memory_id: string, data: string): Promise<any>
}

// Import mem0ai with proper error handling
let Memory: new (config: { apiKey: string }) => IMemory
try {
  Memory = require('mem0ai').Memory
} catch (error) {
  console.warn('mem0ai cloud version not available, falling back to OSS')
}

let memory: IMemory | null = null

export async function initializeMemory() {
  if (!memory) {
    // Check if we have MEM0_API_KEY for cloud version
    const mem0ApiKey = process.env.MEM0_API_KEY

    if (mem0ApiKey) {
      // Use cloud version with API key
      memory = new Memory({
        apiKey: mem0ApiKey,
      })
    } else {
      // Fallback to OSS version with local configuration
      const { Memory: OSSMemory } = await import('mem0ai/oss')
      memory = new OSSMemory({
        version: 'v1.1',
        embedder: {
          provider: 'openai',
          config: {
            apiKey: process.env.OPENAI_API_KEY || '',
            model: 'text-embedding-3-small',
          },
        },
        vectorStore: {
          provider: 'memory',
          config: {
            collectionName: 'aven_memories',
            dimension: 1024,
          },
        },
        llm: {
          provider: 'openai',
          config: {
            apiKey: process.env.OPENAI_API_KEY || '',
            model: 'gpt-4o-mini',
          },
        },
        historyDbPath: './data/memory.db',
        disableHistory: false,
      })
    }
  }
  return memory
}

export async function addToMemory(
  messages: Array<{ role: string; content: string }>,
  userId: string,
  metadata?: Record<string, any>
) {
  try {
    const mem = await initializeMemory()

    // For cloud version, use the messages directly
    // For OSS version, use the existing format
    const mem0ApiKey = process.env.MEM0_API_KEY

    if (mem0ApiKey) {
      // Cloud version - add each message separately or as conversation
      const conversationText = messages.map(m => `${m.role}: ${m.content}`).join('\n')
      const result = await mem.add(conversationText, {
        user_id: userId,
        metadata: {
          timestamp: new Date().toISOString(),
          category: 'conversation',
          ...metadata
        }
      })
      console.log('Memory added (cloud):', result)
      return result
    } else {
      // OSS version
      const result = await mem.add(messages, {
        userId,
        metadata: {
          timestamp: new Date().toISOString(),
          ...metadata
        }
      })
      console.log('Memory added (OSS):', result)
      return result
    }
  } catch (error) {
    console.error('Error adding to memory:', error)
    return null
  }
}

export async function searchMemory(query: string, userId: string) {
  try {
    const mem = await initializeMemory()
    const mem0ApiKey = process.env.MEM0_API_KEY

    if (mem0ApiKey) {
      // Cloud version
      const results = await mem.search(query, { user_id: userId })
      console.log('Memory search results (cloud):', results)
      return results
    } else {
      // OSS version
      const results = await mem.search(query, { userId })
      console.log('Memory search results (OSS):', results)
      return results
    }
  } catch (error) {
    console.error('Error searching memory:', error)
    return []
  }
}

export async function getAllMemories(userId: string) {
  try {
    const mem = await initializeMemory()
    const mem0ApiKey = process.env.MEM0_API_KEY

    if (mem0ApiKey) {
      // Cloud version
      const memories = await mem?.getAll?.({ user_id: userId }) || []
      return memories
    } else {
      // OSS version
      const memories = await mem?.getAll?.({ userId }) || []
      return memories
    }
  } catch (error) {
    console.error('Error getting all memories:', error)
    return []
  }
}

export async function getMemoryContext(query: string, userId: string): Promise<string> {
  try {
    const relevantMemories = await searchMemory(query, userId)
    
    if (relevantMemories.length === 0) {
      return "No previous conversation context found."
    }

    const context = relevantMemories
      .slice(0, 3) // Limit to top 3 most relevant memories
      .map((memory: any, index: number) => `${index + 1}. ${memory.text}`)
      .join('\n')

    return `Previous conversation context:\n${context}`
  } catch (error) {
    console.error('Error getting memory context:', error)
    return "Error retrieving conversation context."
  }
}

export async function deleteUserMemories(userId: string) {
  try {
    const mem = await initializeMemory()
    const mem0ApiKey = process.env.MEM0_API_KEY

    if (mem0ApiKey) {
      // Cloud version
      await mem?.deleteAll?.({ user_id: userId })
      console.log(`All memories deleted for user: ${userId} (cloud)`)
      return true
    } else {
      // OSS version
      await mem?.deleteAll?.({ userId })
      console.log(`All memories deleted for user: ${userId} (OSS)`)
      return true
    }
  } catch (error) {
    console.error('Error deleting user memories:', error)
    return false
  }
}
