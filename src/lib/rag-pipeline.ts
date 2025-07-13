import { AgentStep, SearchResult } from '@/types/agent'
import { searchKnowledgeBase } from './pinecone'
import { searchMemory } from './memory'
import { generateResponse } from './openai'
import { AvenKnowledgeItem } from '@/types'
import { createRAGTrace, RAGTracer } from './langfuse'

export class RAGPipeline {
  private steps: AgentStep[] = []
  private searchResults: SearchResult[] = []
  private onProgressUpdate?: (steps: AgentStep[], results: SearchResult[]) => void
  private tracer?: RAGTracer

  constructor(onProgressUpdate?: (steps: AgentStep[], results: SearchResult[]) => void) {
    this.onProgressUpdate = onProgressUpdate
  }

  private addStep(
    step: AgentStep['step'],
    title: string,
    description: string,
    status: AgentStep['status'] = 'pending'
  ): string {
    const stepId = `${step}-${Date.now()}`
    const newStep: AgentStep = {
      id: stepId,
      step,
      title,
      description,
      status,
      timestamp: new Date()
    }
    
    this.steps.push(newStep)
    this.emitProgress()
    return stepId
  }

  private updateStep(stepId: string, updates: Partial<AgentStep>) {
    const stepIndex = this.steps.findIndex(s => s.id === stepId)
    if (stepIndex !== -1) {
      this.steps[stepIndex] = { ...this.steps[stepIndex], ...updates }
      this.emitProgress()
    }
  }

  private emitProgress() {
    this.onProgressUpdate?.(this.steps, this.searchResults)
  }

  private async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async process(query: string, userId: string): Promise<{
    answer: string
    sources: AvenKnowledgeItem[]
    steps: AgentStep[]
    searchResults: SearchResult[]
    traceId?: string
  }> {
    this.steps = []
    this.searchResults = []

    // Initialize LangFuse tracing
    const sessionId = `rag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.tracer = createRAGTrace(sessionId, userId, query)
    
    const startTime = Date.now()

    try {
      // Step 1: Query Analysis
      const analysisStepId = this.addStep(
        'analyzing',
        'Analyzing Query',
        'Understanding your question and determining the best approach...',
        'active'
      )
      
      this.tracer?.startStep('query_analysis', { query }, { step: 'analyzing' })
      
      await this.delay(800) // Simulate processing time
      
      const analysisResult = { queryType: 'product_information', complexity: 'medium' }
      this.tracer?.endStep(analysisResult, { duration_ms: 800 })
      
      this.updateStep(analysisStepId, {
        status: 'complete',
        description: 'Query analyzed - identified as Aven HELOC inquiry',
        details: analysisResult
      })

      // Step 2: Memory Search
      const memoryStepId = this.addStep(
        'searching_memory',
        'Searching Conversation Memory',
        'Looking for relevant context from previous conversations...',
        'active'
      )

      this.tracer?.startStep('memory_search', { query, userId }, { step: 'searching_memory' })
      const memoryStartTime = Date.now()
      
      const memoryResults = await searchMemory(query, userId)
      
      this.tracer?.logRetrieval('memory_search', query, memoryResults, { 
        type: 'conversation_memory',
        results_count: memoryResults.length,
        duration_ms: Date.now() - memoryStartTime
      })
      this.tracer?.endStep({ results_count: memoryResults.length }, { duration_ms: Date.now() - memoryStartTime })
      
      // Convert memory results to SearchResult format
      const memorySearchResults: SearchResult[] = memoryResults.slice(0, 3).map((memory: any, index: number) => ({
        id: `memory-${index}`,
        title: `Previous Conversation`,
        content: memory.text || memory.content || '',
        source: 'conversation_memory',
        score: 0.85,
        type: 'memory' as const
      }))

      this.searchResults.push(...memorySearchResults)

      this.updateStep(memoryStepId, {
        status: 'complete',
        description: `Found ${memoryResults.length} relevant memories`,
        results: memoryResults
      })

      // Step 3: Knowledge Base Search
      const knowledgeStepId = this.addStep(
        'searching_knowledge',
        'Searching Knowledge Base',
        'Finding relevant documents about Aven services...',
        'active'
      )

      this.tracer?.startStep('knowledge_search', { query }, { step: 'searching_knowledge' })
      const knowledgeStartTime = Date.now()
      
      const knowledgeResults = await searchKnowledgeBase(query)
      
      this.tracer?.logRetrieval('knowledge_search', query, knowledgeResults, { 
        type: 'vector_search',
        results_count: knowledgeResults.length,
        duration_ms: Date.now() - knowledgeStartTime,
        index: 'pinecone'
      })
      this.tracer?.endStep({ results_count: knowledgeResults.length }, { duration_ms: Date.now() - knowledgeStartTime })
      
      // Convert knowledge results to SearchResult format
      const knowledgeSearchResults: SearchResult[] = knowledgeResults.map((doc, index) => ({
        id: `knowledge-${index}`,
        title: doc.title,
        content: doc.content.substring(0, 200) + '...',
        source: doc.url,
        score: 0.9,
        type: 'knowledge' as const
      }))

      this.searchResults.push(...knowledgeSearchResults)

      this.updateStep(knowledgeStepId, {
        status: 'complete',
        description: `Retrieved ${knowledgeResults.length} relevant documents`,
        results: knowledgeResults
      })

      // Step 4: Document Reranking
      const rerankStepId = this.addStep(
        'reranking',
        'Reranking Documents',
        'Scoring and filtering documents for relevance...',
        'active'
      )

      this.tracer?.startStep('document_reranking', { 
        total_documents: this.searchResults.length 
      }, { step: 'reranking' })

      await this.delay(600)

      // Simulate reranking by sorting search results by score
      this.searchResults.sort((a, b) => b.score - a.score)

      const rerankResult = { 
        reranked_count: this.searchResults.length,
        top_score: this.searchResults[0]?.score || 0,
        score_distribution: this.searchResults.slice(0, 5).map(r => r.score)
      }
      this.tracer?.endStep(rerankResult, { duration_ms: 600 })

      this.updateStep(rerankStepId, {
        status: 'complete',
        description: `Reranked ${this.searchResults.length} documents by relevance`,
        details: { topScore: this.searchResults[0]?.score || 0 }
      })

      // Step 5: Context Assembly
      const assemblyStepId = this.addStep(
        'assembling',
        'Assembling Context',
        'Preparing the best context for generating your answer...',
        'active'
      )

      this.tracer?.startStep('context_assembly', { 
        memory_items: memoryResults.length,
        knowledge_items: knowledgeResults.length 
      }, { step: 'assembling' })

      await this.delay(400)

      const memoryContext = memoryResults.length > 0 
        ? `Previous conversation context:\n${memoryResults.slice(0, 2).map((m: any) => m.text).join('\n')}`
        : "No previous conversation context found."

      const assemblyResult = { 
        memoryItems: memoryResults.length,
        knowledgeItems: knowledgeResults.length,
        context_length: memoryContext.length + knowledgeResults.reduce((acc, doc) => acc + doc.content.length, 0)
      }
      this.tracer?.endStep(assemblyResult, { duration_ms: 400 })

      this.updateStep(assemblyStepId, {
        status: 'complete',
        description: 'Context assembled from top-ranked sources',
        details: { 
          memoryItems: memoryResults.length,
          knowledgeItems: knowledgeResults.length 
        }
      })

      // Step 6: Response Generation
      const generationStepId = this.addStep(
        'generating',
        'Generating Response',
        'Creating a personalized answer based on the assembled context...',
        'active'
      )

      this.tracer?.startStep('response_generation', { 
        query,
        context_items: knowledgeResults.length + memoryResults.length
      }, { step: 'generating' })
      const generationStartTime = Date.now()

      const response = await generateResponse(query, knowledgeResults, memoryContext)

      // Log the LLM call for response generation
      this.tracer?.logLLMCall(
        'response_generation',
        'gpt-4.1-mini',
        { query, context: memoryContext, documents: knowledgeResults.length },
        { response, length: response.length },
        { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 }, // Estimated usage
        0.05 // Estimated cost
      )

      const generationResult = {
        response_length: response.length,
        generation_time_ms: Date.now() - generationStartTime
      }
      this.tracer?.endStep(generationResult, { duration_ms: Date.now() - generationStartTime })

      this.updateStep(generationStepId, {
        status: 'complete',
        description: 'Response generated successfully'
      })

      // Final step
      this.addStep(
        'complete',
        'Complete',
        'Your personalized answer is ready!',
        'complete'
      )

      // End the entire trace
      const totalDuration = Date.now() - startTime
      await this.tracer?.endTrace({
        answer: response,
        sources_count: knowledgeResults.length,
        memory_items: memoryResults.length,
        total_steps: this.steps.length
      }, {
        total_duration_ms: totalDuration,
        pipeline_type: 'multi_step_rag',
        success: true
      })

      return {
        answer: response,
        sources: knowledgeResults,
        steps: this.steps,
        searchResults: this.searchResults,
        traceId: this.tracer?.getTraceId()
      }

    } catch (error) {
      console.error('Error in RAG pipeline:', error)
      
      // Log error in trace
      await this.tracer?.endTrace({
        error: error instanceof Error ? error.message : 'Unknown error',
        partial_results: {
          steps_completed: this.steps.filter(s => s.status === 'complete').length,
          total_steps: this.steps.length
        }
      }, {
        total_duration_ms: Date.now() - startTime,
        pipeline_type: 'multi_step_rag',
        success: false,
        error: true
      })
      
      // Mark current active step as error
      const activeStep = this.steps.find(s => s.status === 'active')
      if (activeStep) {
        this.updateStep(activeStep.id, {
          status: 'error',
          description: 'An error occurred during processing'
        })
      }

      throw error
    }
  }
}

export async function processWithRAGPipeline(
  query: string,
  userId: string,
  onProgress?: (steps: AgentStep[], results: SearchResult[]) => void
) {
  const pipeline = new RAGPipeline(onProgress)
  return pipeline.process(query, userId)
}
