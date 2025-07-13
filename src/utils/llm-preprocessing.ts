import { AvenKnowledgeItem } from '@/types'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * LLM-Enhanced Preprocessing
 * Based on the music search example: "I've used an LLM to go do deep research on each song 
 * to come up with a dossier about that song"
 * 
 * Creates rich, searchable content for better RAG performance
 */

interface EnhancedDocument {
  original: AvenKnowledgeItem
  enhanced: AvenKnowledgeItem
  metadata: DocumentMetadata
}

interface DocumentMetadata {
  keyTopics: string[]
  targetAudience: string[]
  questionTypes: string[]
  relatedConcepts: string[]
  searchTerms: string[]
  complexity: 'basic' | 'intermediate' | 'advanced'
  urgency: 'low' | 'medium' | 'high'
}

export class LLMPreprocessing {
  
  /**
   * Create a comprehensive "dossier" for each document
   * This dramatically improves search performance by creating rich, searchable content
   */
  async createDocumentDossier(item: AvenKnowledgeItem): Promise<EnhancedDocument> {
    console.log(`🧠 Creating LLM-enhanced dossier for: ${item.title}`)

    const [dossier, metadata] = await Promise.all([
      this.generateComprehensiveDossier(item),
      this.extractMetadata(item)
    ])

    const enhanced: AvenKnowledgeItem = {
      id: `${item.id}-enhanced`,
      title: `[Enhanced] ${item.title}`,
      content: dossier,
      url: item.url,
      category: item.category
    }

    return {
      original: item,
      enhanced,
      metadata
    }
  }

  private async generateComprehensiveDossier(item: AvenKnowledgeItem): Promise<string> {
    const prompt = `You are creating a comprehensive, searchable dossier for this Aven financial document. Your goal is to make this document findable for ANY related question a customer might ask.

ORIGINAL DOCUMENT:
Title: ${item.title}
Content: ${item.content}

CREATE A COMPREHENSIVE DOSSIER that includes:

1. SUMMARY: Clear, detailed summary of the document
2. KEY FACTS: All important numbers, rates, terms, requirements
3. QUESTIONS THIS ANSWERS: List of specific questions this document can answer
4. CUSTOMER SCENARIOS: When would customers need this information?
5. RELATED TOPICS: What other Aven topics connect to this?
6. SEARCH TERMS: Alternative ways customers might ask about this
7. STEP-BY-STEP PROCESSES: Any procedures or requirements explained simply
8. COMPARISONS: How this relates to traditional banking/credit products
9. COMMON CONCERNS: What customers typically worry about regarding this topic
10. ACTION ITEMS: What customers can/should do after reading this

Make this dossier rich and comprehensive - include synonyms, alternative phrasings, and context that would help match customer queries. Think like a customer service expert anticipating every possible way someone might ask about this topic.`

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1500,
      })

      const dossier = response.choices[0]?.message?.content?.trim() || ''
      
      // Combine original content with enhanced dossier
      return `${item.content}\n\n--- ENHANCED DOSSIER ---\n\n${dossier}`
    } catch (error) {
      console.error('Error generating dossier:', error)
      return item.content
    }
  }

  private async extractMetadata(item: AvenKnowledgeItem): Promise<DocumentMetadata> {
    const prompt = `Analyze this Aven document and extract structured metadata for better search and categorization.

Title: ${item.title}
Content: ${item.content}

Extract the following metadata (respond in JSON format):
{
  "keyTopics": ["topic1", "topic2", "topic3"],
  "targetAudience": ["homeowners", "first-time-applicants", "existing-customers"],
  "questionTypes": ["how-to", "eligibility", "rates", "features"],
  "relatedConcepts": ["concept1", "concept2"],
  "searchTerms": ["term1", "term2", "term3"],
  "complexity": "basic|intermediate|advanced",
  "urgency": "low|medium|high"
}

Guidelines:
- keyTopics: Main subjects (3-5 items)
- targetAudience: Who needs this info
- questionTypes: Types of questions this answers
- relatedConcepts: Connected Aven topics
- searchTerms: Alternative ways to search for this
- complexity: How complex is the information
- urgency: How urgent is this info typically for customers`

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 500,
      })

      const metadataText = response.choices[0]?.message?.content?.trim() || '{}'
      return JSON.parse(metadataText)
    } catch (error) {
      console.error('Error extracting metadata:', error)
      return {
        keyTopics: [item.category],
        targetAudience: ['homeowners'],
        questionTypes: ['general'],
        relatedConcepts: [],
        searchTerms: [item.title.toLowerCase()],
        complexity: 'basic' as const,
        urgency: 'medium' as const
      }
    }
  }

  /**
   * Generate customer question variations for better matching
   */
  async generateQuestionVariations(item: AvenKnowledgeItem): Promise<string[]> {
    const prompt = `Generate 10-15 different ways customers might ask questions that this Aven document could answer.

Document: ${item.title}
Content Summary: ${item.content.substring(0, 300)}...

Generate questions in different styles:
- Direct questions ("What is...")
- Comparative questions ("How does X compare to Y...")
- Process questions ("How do I...")
- Eligibility questions ("Do I qualify...")
- Concern-based questions ("I'm worried about...")
- Scenario questions ("If I...")

Return as a JSON array of strings.`

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 800,
      })

      const questionsText = response.choices[0]?.message?.content?.trim() || '[]'
      return JSON.parse(questionsText)
    } catch (error) {
      console.error('Error generating question variations:', error)
      return []
    }
  }

  /**
   * Create FAQ-style enhanced content
   */
  async createFAQEnhancement(item: AvenKnowledgeItem): Promise<string> {
    const questions = await this.generateQuestionVariations(item)
    
    const prompt = `Using this Aven document, create comprehensive FAQ-style content that answers the provided questions.

DOCUMENT:
${item.content}

QUESTIONS TO ANSWER:
${questions.join('\n')}

For each question, provide a clear, helpful answer based on the document content. If the document doesn't fully answer a question, indicate what information is available and suggest contacting Aven for more details.

Format as:
Q: [Question]
A: [Answer based on document]

This enhanced content will be used to improve search matching for customer queries.`

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 1200,
      })

      return response.choices[0]?.message?.content?.trim() || ''
    } catch (error) {
      console.error('Error creating FAQ enhancement:', error)
      return ''
    }
  }

  /**
   * Batch process documents with rate limiting
   */
  async batchEnhanceDocuments(items: AvenKnowledgeItem[], options: {
    includeMetadata?: boolean
    includeFAQ?: boolean
    includeQuestions?: boolean
  } = {}): Promise<EnhancedDocument[]> {
    console.log(`🚀 Batch enhancing ${items.length} documents with LLM preprocessing`)
    
    const enhanced: EnhancedDocument[] = []
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      console.log(`Enhancing ${i + 1}/${items.length}: ${item.title}`)
      
      try {
        const dossier = await this.createDocumentDossier(item)
        
        // Add optional enhancements
        let additionalContent = ''
        
        if (options.includeFAQ) {
          const faq = await this.createFAQEnhancement(item)
          additionalContent += `\n\n--- FAQ ENHANCEMENT ---\n${faq}`
        }
        
        if (options.includeQuestions) {
          const questions = await this.generateQuestionVariations(item)
          additionalContent += `\n\n--- RELATED QUESTIONS ---\n${questions.join('\n')}`
        }
        
        if (additionalContent) {
          dossier.enhanced.content += additionalContent
        }
        
        enhanced.push(dossier)
        
        // Rate limiting - wait between requests
        await new Promise(resolve => setTimeout(resolve, 1500))
        
      } catch (error) {
        console.error(`Error enhancing ${item.id}:`, error)
        continue
      }
    }
    
    console.log(`✅ Enhanced ${enhanced.length}/${items.length} documents`)
    return enhanced
  }

  /**
   * Create search-optimized content for specific query types
   */
  async optimizeForQueryTypes(item: AvenKnowledgeItem, queryTypes: string[]): Promise<string> {
    const prompt = `Optimize this Aven document content for specific types of customer queries.

DOCUMENT:
${item.content}

OPTIMIZE FOR THESE QUERY TYPES:
${queryTypes.join(', ')}

Create additional content that would help match these specific query patterns. Include:
- Synonyms and alternative phrasings
- Common customer terminology
- Edge cases and exceptions
- Related scenarios

Return the optimized content that can be appended to the original document.`

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 800,
      })

      return response.choices[0]?.message?.content?.trim() || ''
    } catch (error) {
      console.error('Error optimizing for query types:', error)
      return ''
    }
  }
}

export const llmPreprocessing = new LLMPreprocessing()