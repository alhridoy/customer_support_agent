import { searchKnowledgeBase } from '@/lib/pinecone'
import { generateEmbedding } from '@/lib/openai'
import { AvenKnowledgeItem } from '@/types'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface SearchTool {
  name: string
  description: string
  execute: (query: string, context?: string) => Promise<AvenKnowledgeItem[]>
}

/**
 * Agentic Retrieval System
 * Inspired by Augment's SWE-bench approach - agents with persistent search tools
 */
export class AgenticRetrieval {
  private tools: SearchTool[]
  private maxIterations: number = 3
  private searchHistory: string[] = []

  constructor() {
    this.tools = [
      {
        name: 'vector_search',
        description: 'Search using semantic similarity in vector database',
        execute: this.vectorSearch.bind(this)
      },
      {
        name: 'keyword_search', 
        description: 'Search using keyword matching for specific terms',
        execute: this.keywordSearch.bind(this)
      },
      {
        name: 'category_search',
        description: 'Search within specific content categories (heloc, rates, rewards, etc)',
        execute: this.categorySearch.bind(this)
      },
      {
        name: 'related_search',
        description: 'Find related content based on previous search results',
        execute: this.relatedSearch.bind(this)
      }
    ]
  }

  async search(userQuery: string): Promise<{
    results: AvenKnowledgeItem[]
    searchPath: string[]
    confidence: number
  }> {
    this.searchHistory = []
    let allResults: AvenKnowledgeItem[] = []
    let currentQuery = userQuery
    let iteration = 0

    console.log(`🤖 Starting agentic retrieval for: "${userQuery}"`)

    while (iteration < this.maxIterations) {
      iteration++
      
      // Agent decides which tool to use
      const selectedTool = await this.selectTool(currentQuery, allResults, iteration)
      
      console.log(`🔧 Iteration ${iteration}: Using ${selectedTool.name}`)
      this.searchHistory.push(`${iteration}. ${selectedTool.name}: ${currentQuery}`)

      // Execute the selected tool
      const results = await selectedTool.execute(currentQuery, this.getContext(allResults))
      
      // Merge and deduplicate results
      allResults = this.mergeResults(allResults, results)
      
      // Agent decides if it should continue searching
      const shouldContinue = await this.shouldContinueSearch(userQuery, allResults, iteration)
      
      if (!shouldContinue || allResults.length >= 8) {
        console.log(`✅ Stopping search at iteration ${iteration}: sufficient results found`)
        break
      }

      // Generate next search query based on results
      currentQuery = await this.generateNextQuery(userQuery, allResults, iteration)
    }

    const confidence = this.calculateConfidence(userQuery, allResults)
    
    return {
      results: allResults.slice(0, 5), // Top 5 results
      searchPath: this.searchHistory,
      confidence
    }
  }

  private async selectTool(query: string, currentResults: AvenKnowledgeItem[], iteration: number): Promise<SearchTool> {
    // First iteration: always start with vector search
    if (iteration === 1) {
      return this.tools[0] // vector_search
    }

    // Use LLM to select the best tool based on context
    const prompt = `You are a search strategist. Given the user query and current search results, select the best search tool.

User Query: "${query}"
Current Results: ${currentResults.length} documents found
Iteration: ${iteration}

Available Tools:
${this.tools.map((tool, i) => `${i + 1}. ${tool.name}: ${tool.description}`).join('\n')}

Search History: ${this.searchHistory.join('; ')}

Select the tool number (1-${this.tools.length}) that would most likely find additional relevant information.`

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 50,
      })

      const toolNumber = parseInt(response.choices[0]?.message?.content?.trim() || '1')
      const selectedIndex = Math.max(0, Math.min(toolNumber - 1, this.tools.length - 1))
      
      return this.tools[selectedIndex]
    } catch (error) {
      console.error('Error selecting tool:', error)
      return this.tools[1] // Fallback to keyword search
    }
  }

  private async shouldContinueSearch(
    originalQuery: string, 
    currentResults: AvenKnowledgeItem[], 
    iteration: number
  ): Promise<boolean> {
    if (iteration >= this.maxIterations || currentResults.length === 0) {
      return false
    }

    const prompt = `Evaluate if more search is needed to answer this question comprehensively.

Question: "${originalQuery}"
Current Results: ${currentResults.length} documents
Documents Cover: ${currentResults.map(r => r.title).join(', ')}
Iteration: ${iteration}/${this.maxIterations}

Do we have sufficient information to answer the question? Respond with only "YES" or "NO".`

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 10,
      })

      const answer = response.choices[0]?.message?.content?.trim().toLowerCase()
      return answer === 'no'
    } catch (error) {
      console.error('Error evaluating search completion:', error)
      return false
    }
  }

  private async generateNextQuery(
    originalQuery: string,
    currentResults: AvenKnowledgeItem[],
    iteration: number
  ): Promise<string> {
    const prompt = `Generate a focused search query to find missing information.

Original Question: "${originalQuery}"
Found Documents: ${currentResults.map(r => r.title).join(', ')}
Iteration: ${iteration}

What specific aspect of the question still needs more information? Generate a concise search query (max 10 words).`

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 50,
      })

      return response.choices[0]?.message?.content?.trim() || originalQuery
    } catch (error) {
      console.error('Error generating next query:', error)
      return originalQuery
    }
  }

  // Search tool implementations
  private async vectorSearch(query: string): Promise<AvenKnowledgeItem[]> {
    return await searchKnowledgeBase(query)
  }

  private async keywordSearch(query: string): Promise<AvenKnowledgeItem[]> {
    // Extract key terms and search for exact matches
    const keywords = query.toLowerCase().match(/\b\w{3,}\b/g) || []
    const keywordQuery = keywords.join(' ')
    
    const results = await searchKnowledgeBase(keywordQuery)
    
    // Filter for results that contain the actual keywords
    return results.filter(result => {
      const content = (result.title + ' ' + result.content).toLowerCase()
      return keywords.some(keyword => content.includes(keyword))
    })
  }

  private async categorySearch(query: string, context?: string): Promise<AvenKnowledgeItem[]> {
    // Determine relevant categories
    const categories = ['heloc', 'rates-fees', 'rewards', 'application', 'support', 'eligibility']
    
    const prompt = `What Aven product categories are most relevant to this query?
Query: "${query}"
Available categories: ${categories.join(', ')}

Select 1-2 most relevant categories (comma-separated).`

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 30,
      })

      const selectedCategories = response.choices[0]?.message?.content?.trim().split(',').map(c => c.trim()) || ['heloc']
      
      const allResults = await searchKnowledgeBase(query)
      
      return allResults.filter(result => 
        selectedCategories.some(category => result.category === category)
      )
    } catch (error) {
      console.error('Error in category search:', error)
      return await searchKnowledgeBase(query)
    }
  }

  private async relatedSearch(query: string, context?: string): Promise<AvenKnowledgeItem[]> {
    if (!context) {
      return []
    }

    // Generate related search terms based on context
    const prompt = `Based on these documents, what related terms should we search for?

Original Query: "${query}"
Document Context: ${context.substring(0, 500)}...

Generate 2-3 related search terms that might find additional relevant information.`

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 50,
      })

      const relatedTerms = response.choices[0]?.message?.content?.trim() || query
      return await searchKnowledgeBase(relatedTerms)
    } catch (error) {
      console.error('Error in related search:', error)
      return []
    }
  }

  private mergeResults(existing: AvenKnowledgeItem[], newResults: AvenKnowledgeItem[]): AvenKnowledgeItem[] {
    const seen = new Set(existing.map(r => r.id))
    const uniqueNew = newResults.filter(r => !seen.has(r.id))
    
    return [...existing, ...uniqueNew]
  }

  private getContext(results: AvenKnowledgeItem[]): string {
    return results
      .slice(0, 3)
      .map(r => `${r.title}: ${r.content.substring(0, 200)}...`)
      .join('\n')
  }

  private calculateConfidence(query: string, results: AvenKnowledgeItem[]): number {
    if (results.length === 0) return 0
    if (results.length >= 3) return 0.9
    if (results.length >= 2) return 0.7
    return 0.5
  }
}

export const agenticRetrieval = new AgenticRetrieval()