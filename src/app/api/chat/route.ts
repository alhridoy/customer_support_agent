import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { searchKnowledgeBase } from '@/lib/pinecone'
import { generateResponse } from '@/lib/openai'
import { addToMemory, getMemoryContext } from '@/lib/memory'
import { RAGResponse } from '@/types'
import { agenticRetrieval } from '@/utils/agentic-retrieval'
import { agentMemory } from '@/utils/agent-memory'
import { meetingScheduler } from '@/utils/meeting-scheduler'
import { createRAGTrace } from '@/lib/langfuse'
import { getInstantResponse } from '@/lib/fast-responses'
import { processWithRAGPipeline } from '@/lib/rag-pipeline'

// Input validation schema
const chatRequestSchema = z.object({
  message: z.string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message too long (max 2000 characters)'),
  userId: z.string()
    .trim()
    .min(1, 'User ID is required')
    .max(100, 'User ID too long')
    .default('anonymous'),
  sessionId: z.string()
    .trim()
    .max(100, 'Session ID too long')
    .optional(),
  customerNotes: z.string()
    .trim()
    .max(1000, 'Customer notes too long (max 1000 characters)')
    .optional(),
  useFullPipeline: z.boolean().default(true),
})

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Chat API called')
    const startTime = Date.now()

    // Parse and validate request body
    const body = await request.json()
    const validationResult = chatRequestSchema.safeParse(body)

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err =>
        `${err.path.join('.')}: ${err.message}`
      ).join(', ')

      return NextResponse.json(
        { error: `Invalid input: ${errors}` },
        { status: 400 }
      )
    }

    const { message, userId, sessionId, customerNotes, useFullPipeline } = validationResult.data
    console.log('📝 Message:', message.substring(0, 100) + (message.length > 100 ? '...' : ''))

    // Check for instant responses first while keeping full pipeline for complex queries
    const instantResponse = getInstantResponse(message)
    if (instantResponse) {
      console.log(`⚡ Instant response in ${Date.now() - startTime}ms`)
      return NextResponse.json(instantResponse)
    }

    // Generate a unique user ID if not provided
    const effectiveUserId = userId === 'anonymous' ? `session_${sessionId || Date.now()}` : userId

    // Initialize LangFuse tracing for text chat
    const chatSessionId = sessionId || `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const tracer = createRAGTrace(chatSessionId, effectiveUserId, message)

    // Check if we have real API keys
    const hasRealKeys = process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('placeholder')
    console.log('🔑 Has real API keys:', hasRealKeys)

    if (!hasRealKeys) {
      // Return a demo response when API keys are placeholders
      console.log('📋 Using demo response')
      const demoResponse = getDemoResponse(message)
      await tracer.endTrace({ response: demoResponse, mode: 'demo' }, { 
        total_duration_ms: Date.now() - startTime,
        demo_mode: true 
      })
      return NextResponse.json(demoResponse)
    }

    // CHECK FOR FULL RAG PIPELINE REQUEST
    if (useFullPipeline) {
      console.log('🔄 Using full 6-step RAG pipeline...')
      try {
        const ragResult = await processWithRAGPipeline(message, effectiveUserId)
        
        // Store the conversation in memory async
        addToMemory([
          { role: 'user', content: message },
          { role: 'assistant', content: ragResult.answer }
        ], effectiveUserId, {
          category: 'aven_support_rag',
          hasKnowledgeBase: ragResult.sources.length > 0,
          pipeline_type: 'multi_step_rag'
        }).catch(console.error)

        const result: RAGResponse = {
          answer: ragResult.answer,
          sources: ragResult.sources,
          confidence: ragResult.sources.length > 0 ? 0.9 : 0.6,
          steps: ragResult.steps,
          searchResults: ragResult.searchResults,
          traceId: ragResult.traceId
        }

        console.log(`🎯 Full RAG pipeline completed in ${Date.now() - startTime}ms`)
        return NextResponse.json(result)
      } catch (ragError) {
        console.error('Error in full RAG pipeline:', ragError)
        // Fall through to optimized pipeline
      }
    }

    // PARALLEL OPTIMIZATION: Run memory context and meeting check simultaneously
    console.log('🧠 Getting memory context and checking for meeting requests...')
    const [memoryContext, isSchedulingRequest] = await Promise.all([
      getMemoryContext(message, effectiveUserId).catch(() => ''), // Don't fail on memory errors
      Promise.resolve(['schedule', 'appointment', 'meeting', 'book', 'reserve', 'consultation']
        .some(keyword => message.toLowerCase().includes(keyword)))
    ])

    // Meeting scheduling handled above in parallel

    if (isSchedulingRequest) {
      console.log('📅 Processing meeting scheduling request...')
      try {
        const schedulingResult = await meetingScheduler.parseAndSchedule(message, effectiveUserId)
        
        if (schedulingResult.success) {
          const meeting = schedulingResult.meeting!
          const result: RAGResponse = {
            answer: `${schedulingResult.message} Your meeting details:\n\n📅 Date: ${meeting.date}\n🕐 Time: ${meeting.time}\n📋 Type: ${meeting.meetingType}\n🆔 Meeting ID: ${meeting.id}\n\nYou can reschedule or cancel this meeting by referencing the Meeting ID.`,
            sources: [{
              id: 'meeting-scheduler',
              title: 'Meeting Scheduled Successfully',
              content: `Meeting scheduled for ${meeting.date} at ${meeting.time}`,
              url: '#',
              category: 'scheduling'
            }],
            confidence: 1.0
          }
          return NextResponse.json(result)
        } else {
          // If scheduling failed, provide scheduling help
          const availableSlots = meetingScheduler.getAvailableSlots().slice(0, 5)
          const slotsText = availableSlots.map(slot => `${slot.date} at ${slot.time}`).join(', ')
          
          const result: RAGResponse = {
            answer: `${schedulingResult.message}\n\nHere are some available time slots: ${slotsText}\n\nTo schedule a meeting, please specify a date and time, for example: "Schedule a consultation for December 15th at 2 PM"`,
            sources: [{
              id: 'meeting-scheduler-help',
              title: 'Meeting Scheduling Help',
              content: 'Available meeting slots and scheduling instructions',
              url: '#',
              category: 'scheduling'
            }],
            confidence: 0.8
          }
          return NextResponse.json(result)
        }
      } catch (schedulingError) {
        console.error('Error in meeting scheduling:', schedulingError)
        // Continue to normal chat flow if scheduling fails
      }
    }

    // PARALLEL OPTIMIZATION: Check cache and start agentic retrieval simultaneously
    console.log('⚡ Checking semantic cache and preparing agentic retrieval...')
    const [cachedResults, agenticBackupResults] = await Promise.allSettled([
      agentMemory.checkSemanticCache(message).catch(() => null),
      agenticRetrieval.search(message).catch(async () => {
        // Fallback to basic search
        try {
          const basicResults = await searchKnowledgeBase(message)
          return { results: basicResults, confidence: 0.5, searchPath: ['basic_search'] }
        } catch {
          return { results: [], confidence: 0, searchPath: ['fallback'] }
        }
      })
    ])
    
    let relevantDocs
    const cacheResult = cachedResults.status === 'fulfilled' ? cachedResults.value : null
    
    if (cacheResult) {
      console.log('⚡ Using cached results')
      relevantDocs = cacheResult
      
      // Cache hit, but still update cache async with new agentic results if available
      if (agenticBackupResults.status === 'fulfilled') {
        agentMemory.addToSemanticCache(message, agenticBackupResults.value.results).catch(console.error)
      }
    } else {
      // Use agentic results
      const agenticResult = agenticBackupResults.status === 'fulfilled' ? agenticBackupResults.value : { results: [], confidence: 0, searchPath: ['error'] }
      relevantDocs = agenticResult.results
      
      console.log(`🔍 Agentic search found ${relevantDocs.length} results with confidence ${agenticResult.confidence}`)
      console.log(`📊 Search path: ${agenticResult.searchPath.join(' → ')}`)
      
      // Add to cache async (don't wait)
      agentMemory.addToSemanticCache(message, relevantDocs).catch(console.error)
    }

    // Generate response using OpenAI with memory context
    console.log('🤖 Generating response...')
    const response = await generateResponse(message, relevantDocs, memoryContext)

    // ASYNC OPTIMIZATION: Run memory storage, learning, and tracing in parallel (don't block response)
    const asyncOperations = Promise.allSettled([
      // Store conversation in memory
      addToMemory([
        { role: 'user', content: message },
        { role: 'assistant', content: response }
      ], effectiveUserId, {
        category: 'aven_support',
        hasKnowledgeBase: relevantDocs.length > 0
      }).catch(console.error),
      
      // Learn from interaction for future improvements
      agentMemory.learnFromInteraction(message, response, relevantDocs, effectiveUserId).catch(console.error),
      
      // End LangFuse trace
      tracer.endTrace({
        answer: response,
        sources_count: relevantDocs.length,
        confidence: relevantDocs.length > 0 ? 0.8 : 0.5
      }, {
        total_duration_ms: Date.now() - startTime,
        success: true,
        pipeline_type: 'text_chat'
      }).catch(console.error)
    ])

    // Don't await - let these run in background
    asyncOperations.catch(console.error)
    
    console.log(`⚡ Response generated in ${Date.now() - startTime}ms (async operations continuing in background)`)

    const result: RAGResponse = {
      answer: response,
      sources: relevantDocs,
      confidence: relevantDocs.length > 0 ? 0.8 : 0.5
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in chat API:', error)
    
    // Log error in trace
    await tracer.endTrace({
      error: error instanceof Error ? error.message : 'Unknown error',
      partial_response: true
    }, {
      total_duration_ms: Date.now() - startTime,
      success: false,
      error: true
    })
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function getDemoResponse(message: string): RAGResponse {
  const lowerMessage = message.toLowerCase()
  
  let answer = "I'm a demo version of the Aven AI Customer Support Agent. "
  
  // Check for meeting scheduling requests in demo mode
  const meetingKeywords = ['schedule', 'appointment', 'meeting', 'book', 'reserve', 'consultation']
  const isSchedulingRequest = meetingKeywords.some(keyword => lowerMessage.includes(keyword))
  
  if (isSchedulingRequest) {
    answer = "I can help you schedule a meeting with an Aven representative! In demo mode, I can show you how the scheduling works. Try asking: 'Schedule a consultation for tomorrow at 2 PM' or 'Book an appointment for Friday at 10 AM'. Available meeting types include: consultation, application help, account review, and general inquiries."
  } else if (lowerMessage.includes('heloc') || lowerMessage.includes('credit card')) {
    answer = "The Aven HELOC Credit Card allows homeowners to access their home equity with credit limits up to $250,000. It offers 7.99% - 15.49% variable interest rates, 2% cashback on all purchases, and 7% cashback on travel booked through Aven's portal. There's no annual fee and approval can be as fast as 5 minutes."
  } else if (lowerMessage.includes('interest rate') || lowerMessage.includes('apr')) {
    answer = "The Aven HELOC Credit Card offers variable interest rates from 7.99% to 15.49%, with a maximum of 18% during the life of the account. There's also a 0.25% autopay discount available."
  } else if (lowerMessage.includes('cashback') || lowerMessage.includes('rewards')) {
    answer = "Aven offers 2% cashback on all purchases and 7% cashback on travel bookings made through Aven's travel portal. There are no annual fees."
  } else if (lowerMessage.includes('apply') || lowerMessage.includes('eligibility')) {
    answer = "To be eligible for the Aven HELOC Credit Card, you must be a homeowner with sufficient home equity, have a credit score typically around 600 or higher, and meet stable income requirements (usually $50k+ annually). The application process is quick, with approval decisions as fast as 5 minutes."
  } else {
    answer += "I can help you with questions about Aven's HELOC Credit Card, including features, interest rates, cashback rewards, eligibility requirements, application process, and meeting scheduling. To enable full functionality with real-time data, please set up your API keys in the environment variables."
  }
  
  return {
    answer,
    sources: [{
      id: 'demo-source',
      title: 'Aven HELOC Credit Card Information',
      content: 'Demo information about Aven services',
      url: 'https://www.aven.com',
      category: 'demo'
    }],
    confidence: 0.8
  }
}
