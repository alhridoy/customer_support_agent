import { Langfuse } from 'langfuse'

// Initialize LangFuse client
const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
  flushAt: 1, // Send traces immediately for development
  requestTimeout: 10000 // 10 second timeout
})

// Custom trace utility for RAG pipeline
export class RAGTracer {
  private trace: any
  private currentSpan: any

  constructor(sessionId: string, userId: string, input: string) {
    this.trace = langfuse.trace({
      sessionId,
      userId,
      name: 'rag_pipeline',
      input: { query: input },
      tags: ['rag', 'aven_support'],
      metadata: {
        pipeline: 'multi_step_rag',
        timestamp: new Date().toISOString()
      }
    })
  }

  // Start a new step in the RAG pipeline
  startStep(stepName: string, input?: any, metadata?: any) {
    this.currentSpan = this.trace.span({
      name: stepName,
      input,
      metadata: {
        step: stepName,
        ...metadata
      }
    })
    return this.currentSpan
  }

  // End current step with output and metrics
  endStep(output?: any, metadata?: any) {
    if (this.currentSpan) {
      this.currentSpan.end({
        output,
        metadata
      })
    }
  }

  // Log LLM calls within steps
  logLLMCall(stepName: string, model: string, input: any, output: any, usage?: any, cost?: number) {
    const generation = this.trace.generation({
      name: `${stepName}_llm_call`,
      model,
      input,
      output,
      usage,
      metadata: {
        step: stepName,
        cost: cost || 0
      }
    })
    return generation
  }

  // Log retrieval operations
  logRetrieval(stepName: string, query: string, results: any[], metadata?: any) {
    const span = this.trace.span({
      name: `${stepName}_retrieval`,
      input: { query },
      output: { 
        results_count: results.length,
        results: results.slice(0, 3) // Log first 3 results to avoid too much data
      },
      metadata: {
        step: stepName,
        retrieval_type: metadata?.type || 'vector_search',
        ...metadata
      }
    })
    span.end()
    return span
  }

  // Log evaluation scores
  logEvaluation(stepName: string, metrics: any) {
    this.trace.score({
      name: `${stepName}_evaluation`,
      value: metrics.score || 0,
      comment: JSON.stringify(metrics)
    })
  }

  // End the entire trace
  async endTrace(output: any, metadata?: any) {
    this.trace.update({
      output,
      metadata: {
        completed_at: new Date().toISOString(),
        ...metadata
      }
    })
    
    // Flush immediately to ensure trace is sent
    try {
      await langfuse.flushAsync()
    } catch (error) {
      console.error('Failed to flush LangFuse trace:', error)
    }
  }

  // Get trace ID for linking
  getTraceId() {
    return this.trace.id
  }
}

// Voice pipeline tracer
export class VoiceTracer {
  private trace: any
  private currentSpan: any

  constructor(callId: string, userId: string, transcript: string) {
    this.trace = langfuse.trace({
      sessionId: callId,
      userId,
      name: 'voice_pipeline',
      input: { transcript },
      tags: ['voice', 'vapi', 'aven_support'],
      metadata: {
        pipeline: 'voice_to_rag_to_voice',
        call_id: callId,
        timestamp: new Date().toISOString()
      }
    })
  }

  // Log voice processing steps
  logVoiceStep(stepName: string, input: any, output: any, metadata?: any) {
    const span = this.trace.span({
      name: stepName,
      input,
      output,
      metadata: {
        voice_step: stepName,
        ...metadata
      }
    })
    span.end()
    return span
  }

  // Log external service calls (11Labs, Deepgram, etc.)
  logExternalService(serviceName: string, input: any, output: any, cost?: number, duration?: number) {
    const span = this.trace.span({
      name: `${serviceName}_call`,
      input,
      output,
      metadata: {
        service: serviceName,
        cost: cost || 0,
        duration_ms: duration || 0
      }
    })
    span.end()
    return span
  }

  // End voice trace
  async endTrace(output: any, metadata?: any) {
    this.trace.update({
      output,
      metadata: {
        completed_at: new Date().toISOString(),
        ...metadata
      }
    })
    
    // Flush immediately to ensure trace is sent
    try {
      await langfuse.flushAsync()
    } catch (error) {
      console.error('Failed to flush LangFuse voice trace:', error)
    }
  }

  getTraceId() {
    return this.trace.id
  }
}

// Utility functions
export const createRAGTrace = (sessionId: string, userId: string, input: string) => {
  return new RAGTracer(sessionId, userId, input)
}

export const createVoiceTrace = (callId: string, userId: string, transcript: string) => {
  return new VoiceTracer(callId, userId, transcript)
}

// Evaluation utilities
export const logCustomEvaluation = (traceId: string, evaluationName: string, score: number, comment?: string) => {
  langfuse.score({
    traceId,
    name: evaluationName,
    value: score,
    comment
  })
}

// Flush traces (call before app shutdown)
export const flushTraces = async () => {
  await langfuse.flushAsync()
}

export default langfuse