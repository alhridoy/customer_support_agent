import { NextRequest } from 'next/server'
import { processWithRAGPipeline } from '@/lib/rag-pipeline'
import { addToMemory } from '@/lib/memory'

export async function POST(request: NextRequest) {
  const { message, userId = 'anonymous', sessionId } = await request.json()

  if (!message) {
    return new Response('Message is required', { status: 400 })
  }

  const effectiveUserId = userId === 'anonymous' ? `session_${sessionId || Date.now()}` : userId

  // Create a readable stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      try {
        // Process with RAG pipeline and emit progress updates
        const result = await processWithRAGPipeline(
          message,
          effectiveUserId,
          (steps, searchResults) => {
            // Send progress update
            const progressData = {
              type: 'progress',
              data: { steps, searchResults }
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressData)}\n\n`))
          }
        )

        // Store conversation in memory
        await addToMemory([
          { role: 'user', content: message },
          { role: 'assistant', content: result.answer }
        ], effectiveUserId, {
          category: 'aven_support',
          hasKnowledgeBase: result.sources.length > 0
        })

        // Send final response
        const finalData = {
          type: 'response',
          data: {
            answer: result.answer,
            sources: result.sources,
            confidence: result.sources.length > 0 ? 0.8 : 0.5
          }
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalData)}\n\n`))

        // Send completion signal
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'complete' })}\n\n`))
        controller.close()

      } catch (error) {
        console.error('Error in streaming chat:', error)
        const errorData = {
          type: 'error',
          data: { error: 'An error occurred while processing your request' }
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`))
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
