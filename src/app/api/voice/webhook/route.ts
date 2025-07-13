import { NextRequest, NextResponse } from 'next/server'
import { searchKnowledgeBase } from '@/lib/pinecone'
import { generateResponse } from '@/lib/openai'
import { addToMemory, getMemoryContext } from '@/lib/memory'
import { agenticRetrieval } from '@/utils/agentic-retrieval'
import { agentMemory } from '@/utils/agent-memory'
import { meetingScheduler } from '@/utils/meeting-scheduler'
import { createVoiceTrace, VoiceTracer } from '@/lib/langfuse'

async function processVoiceQuery(userMessage: string, userId: string, callId?: string): Promise<string> {
  console.log('📝 Processing voice query:', userMessage)
  console.log('👤 User ID:', userId)

  // Initialize voice tracing
  const voiceTracer = createVoiceTrace(callId || `voice_${Date.now()}`, userId, userMessage)
  const startTime = Date.now()

  // Check if we have real API keys
  const hasRealKeys = process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('placeholder')
  console.log('🔑 Has real API keys:', hasRealKeys)

  if (!hasRealKeys) {
    const demoResponse = getVoiceDemoResponse(userMessage)
    await voiceTracer.endTrace({ response: demoResponse, mode: 'demo' }, { 
      total_duration_ms: Date.now() - startTime,
      demo_mode: true 
    })
    return demoResponse
  }

  try {
    // Get memory context for this voice user
    console.log('🧠 Getting memory context...')
    voiceTracer.logVoiceStep('memory_retrieval', { query: userMessage, userId }, {}, { step: 'memory_search' })
    const memoryContext = await getMemoryContext(userMessage, userId)
    voiceTracer.logVoiceStep('memory_retrieval_complete', { query: userMessage }, { context_length: memoryContext.length }, { step: 'memory_search' })

    // Check if this is a meeting scheduling request
    const meetingKeywords = ['schedule', 'appointment', 'meeting', 'book', 'reserve', 'consultation']
    const isSchedulingRequest = meetingKeywords.some(keyword => 
      userMessage.toLowerCase().includes(keyword)
    )

    if (isSchedulingRequest) {
      console.log('📅 Processing voice meeting scheduling request...')
      voiceTracer.logVoiceStep('meeting_scheduling_start', { query: userMessage }, {}, { step: 'meeting_scheduling' })
      
      try {
        const schedulingResult = await meetingScheduler.parseAndSchedule(userMessage, userId)
        
        if (schedulingResult.success) {
          const meeting = schedulingResult.meeting!
          const response = `Great! ${schedulingResult.message} I've scheduled your meeting for ${meeting.date} at ${meeting.time}. Your meeting type is ${meeting.meetingType} and your meeting ID is ${meeting.id}. You can reschedule or cancel this meeting by referencing the Meeting ID.`
          
          voiceTracer.logVoiceStep('meeting_scheduling_success', { schedulingResult }, { meeting }, { step: 'meeting_scheduling' })
          await voiceTracer.endTrace({ response, meeting_scheduled: true }, { 
            total_duration_ms: Date.now() - startTime,
            scheduling_success: true 
          })
          
          return response
        } else {
          const availableSlots = meetingScheduler.getAvailableSlots().slice(0, 3)
          const slotsText = availableSlots.map(slot => `${slot.date} at ${slot.time}`).join(', ')
          const response = `${schedulingResult.message} Here are some available time slots: ${slotsText}. To schedule a meeting, please specify a date and time, for example: "Schedule a consultation for December 15th at 2 PM"`
          
          voiceTracer.logVoiceStep('meeting_scheduling_partial', { schedulingResult }, { available_slots: availableSlots }, { step: 'meeting_scheduling' })
          await voiceTracer.endTrace({ response, meeting_scheduled: false }, { 
            total_duration_ms: Date.now() - startTime,
            scheduling_success: false 
          })
          
          return response
        }
      } catch (schedulingError) {
        console.error('Error in voice meeting scheduling:', schedulingError)
        voiceTracer.logVoiceStep('meeting_scheduling_error', { error: schedulingError }, {}, { step: 'meeting_scheduling' })
        // Continue to normal voice flow if scheduling fails
      }
    }

    // Check semantic cache first
    console.log('⚡ Checking semantic cache...')
    voiceTracer.logVoiceStep('cache_check_start', { query: userMessage }, {}, { step: 'cache_check' })
    let cachedResults
    try {
      cachedResults = await agentMemory.checkSemanticCache(userMessage)
      voiceTracer.logVoiceStep('cache_check_complete', { cache_hit: !!cachedResults }, {}, { step: 'cache_check' })
    } catch (cacheError) {
      console.error('Cache error:', cacheError)
      voiceTracer.logVoiceStep('cache_check_error', { error: cacheError }, {}, { step: 'cache_check' })
      cachedResults = null
    }
    
    let relevantDocs
    if (cachedResults) {
      console.log('⚡ Using cached results for voice')
      voiceTracer.logVoiceStep('using_cached_results', { results_count: cachedResults.length }, {}, { step: 'retrieval' })
      relevantDocs = cachedResults
    } else {
      // Use agentic retrieval for better results
      console.log('🤖 Using agentic retrieval for voice')
      voiceTracer.logVoiceStep('agentic_retrieval_start', { query: userMessage }, {}, { step: 'retrieval' })
      
      try {
        const agenticResults = await agenticRetrieval.search(userMessage)
        relevantDocs = agenticResults.results
        
        voiceTracer.logVoiceStep('agentic_retrieval_success', { 
          results_count: relevantDocs.length,
          confidence: agenticResults.confidence,
          search_path: agenticResults.searchPath 
        }, { results: relevantDocs.slice(0, 3) }, { step: 'retrieval' })
        
        // Add successful search to cache
        await agentMemory.addToSemanticCache(userMessage, relevantDocs)
        
        console.log(`🔍 Voice agentic search found ${relevantDocs.length} results with confidence ${agenticResults.confidence}`)
        console.log(`📊 Voice search path: ${agenticResults.searchPath.join(' → ')}`)
      } catch (retrievalError) {
        console.error('Error in voice agentic retrieval:', retrievalError)
        voiceTracer.logVoiceStep('agentic_retrieval_error', { error: retrievalError }, {}, { step: 'retrieval' })
        
        // Fallback to basic search
        try {
          voiceTracer.logVoiceStep('fallback_search_start', { query: userMessage }, {}, { step: 'retrieval' })
          relevantDocs = await searchKnowledgeBase(userMessage)
          voiceTracer.logVoiceStep('fallback_search_success', { results_count: relevantDocs.length }, {}, { step: 'retrieval' })
          console.log(`🔍 Voice fallback search found ${relevantDocs.length} results`)
        } catch (searchError) {
          console.error('Error in voice basic search:', searchError)
          voiceTracer.logVoiceStep('fallback_search_error', { error: searchError }, {}, { step: 'retrieval' })
          relevantDocs = []
        }
      }
    }

    // Generate response optimized for voice
    console.log('🤖 Generating voice response...')
    voiceTracer.logVoiceStep('response_generation_start', { 
      query: userMessage,
      context_items: relevantDocs.length 
    }, {}, { step: 'generation' })
    
    const voicePrompt = `You are Aven's AI voice assistant. Provide a clear, concise, and conversational response suitable for voice delivery. Keep responses under 200 words and speak naturally as if talking to a customer over the phone. Focus on being helpful and friendly.

User question: ${userMessage}

Context from previous conversation: ${memoryContext}

Use the following knowledge base information to answer the user's question:`

    const generationStartTime = Date.now()
    const response = await generateResponse(userMessage, relevantDocs, memoryContext, voicePrompt)

    // Log LLM generation for voice
    voiceTracer.logExternalService('openai_generation', {
      model: 'gpt-4o-mini',
      prompt: voicePrompt,
      context_length: memoryContext.length + relevantDocs.reduce((acc, doc) => acc + doc.content.length, 0)
    }, {
      response,
      response_length: response.length
    }, 0.03, Date.now() - generationStartTime)

    // Make response more voice-friendly
    const voiceResponse = optimizeForVoice(response)
    
    voiceTracer.logVoiceStep('voice_optimization', { 
      original_length: response.length,
      optimized_length: voiceResponse.length 
    }, {}, { step: 'generation' })

    // Store the voice conversation in memory
    console.log('💾 Storing voice conversation in memory...')
    voiceTracer.logVoiceStep('memory_storage_start', { 
      user_message: userMessage,
      assistant_response: voiceResponse 
    }, {}, { step: 'memory_storage' })
    
    try {
      await addToMemory([
        { role: 'user', content: userMessage },
        { role: 'assistant', content: voiceResponse }
      ], userId, {
        category: 'aven_voice_support',
        hasKnowledgeBase: relevantDocs.length > 0,
        channel: 'voice'
      })
      voiceTracer.logVoiceStep('memory_storage_success', {}, {}, { step: 'memory_storage' })
    } catch (memoryError) {
      console.error('Error storing voice memory:', memoryError)
      voiceTracer.logVoiceStep('memory_storage_error', { error: memoryError }, {}, { step: 'memory_storage' })
    }

    // Learn from voice interaction
    console.log('📚 Learning from voice interaction...')
    voiceTracer.logVoiceStep('learning_start', {}, {}, { step: 'learning' })
    
    try {
      await agentMemory.learnFromInteraction(userMessage, voiceResponse, relevantDocs, userId)
      voiceTracer.logVoiceStep('learning_success', {}, {}, { step: 'learning' })
    } catch (learningError) {
      console.error('Error in voice learning:', learningError)
      voiceTracer.logVoiceStep('learning_error', { error: learningError }, {}, { step: 'learning' })
    }

    // End voice trace with success
    await voiceTracer.endTrace({
      response: voiceResponse,
      sources_count: relevantDocs.length,
      voice_optimized: true
    }, {
      total_duration_ms: Date.now() - startTime,
      success: true,
      pipeline_type: 'voice_rag'
    })

    return voiceResponse

  } catch (error) {
    console.error('Error in processVoiceQuery:', error)
    
    // Log error in voice trace
    await voiceTracer.endTrace({
      error: error instanceof Error ? error.message : 'Unknown error',
      partial_response: true
    }, {
      total_duration_ms: Date.now() - startTime,
      success: false,
      error: true
    })
    
    return "I apologize, but I'm experiencing some technical difficulties. Please try asking your question again, or you can always contact our support team directly."
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🎤 Voice webhook called')
    const body = await request.json()
    console.log('📞 Voice webhook payload:', JSON.stringify(body, null, 2))

    // Handle different VAPI message types
    const { message, call } = body

    if (!message) {
      return NextResponse.json({ error: 'No message provided' }, { status: 400 })
    }

    // Extract the user's transcribed message
    let userMessage = ''
    let userId = call?.customer?.number || call?.id || 'voice-user'
    
    if (message.type === 'function-call') {
      // Handle function calls from VAPI
      const { functionCall } = message
      if (functionCall?.name === 'searchKnowledge') {
        userMessage = functionCall.parameters?.query || ''
        console.log('🔍 Function call - searchKnowledge:', userMessage)
        
        // Process the search and return result for function call
        const searchResult = await processVoiceQuery(userMessage, userId, call?.id)
        return NextResponse.json({
          result: searchResult
        })
      }
    } else if (message.transcript) {
      // Handle direct transcript - but we want VAPI to call searchKnowledge function instead
      userMessage = message.transcript
      console.log('📝 Direct transcript (should trigger function call):', userMessage)
      return NextResponse.json({
        result: "Let me search for information about that for you.",
        // This should trigger the assistant to call searchKnowledge function
      })
    } else {
      console.log('❓ Unknown message type:', message.type)
      return NextResponse.json({ 
        error: 'Unsupported message type',
        type: message.type 
      }, { status: 400 })
    }

    // This should not be reached since we handle function calls above
    return NextResponse.json({
      result: "I'm here to help with questions about Aven. Please ask me anything about our HELOC Credit Card!"
    })

  } catch (error) {
    console.error('Error in voice webhook:', error)
    return NextResponse.json({
      result: "I apologize, but I'm experiencing some technical difficulties. Please try asking your question again, or you can always contact our support team directly."
    }, { status: 200 }) // Return 200 to avoid VAPI retries
  }
}

function optimizeForVoice(text: string): string {
  return text
    // Remove markdown formatting
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/#{1,6}\s/g, '')
    
    // Replace bullet points with verbal connectors
    .replace(/^- /gm, '')
    .replace(/^\* /gm, '')
    .replace(/^\d+\. /gm, '')
    
    // Replace line breaks with natural pauses
    .replace(/\n\n/g, '. ')
    .replace(/\n/g, ', ')
    
    // Clean up extra spaces
    .replace(/\s+/g, ' ')
    .trim()
    
    // Ensure it ends with proper punctuation
    .replace(/[.!?]*$/, '.')
}

function getVoiceDemoResponse(message: string): string {
  const lowerMessage = message.toLowerCase()
  
  let response = "Hello! I'm Aven's AI voice assistant in demo mode. "
  
  // Check for meeting scheduling requests
  const meetingKeywords = ['schedule', 'appointment', 'meeting', 'book', 'reserve', 'consultation']
  const isSchedulingRequest = meetingKeywords.some(keyword => lowerMessage.includes(keyword))
  
  if (isSchedulingRequest) {
    response = "I can help you schedule a meeting with an Aven representative! In demo mode, I can show you how the scheduling works. Try saying: 'Schedule a consultation for tomorrow at 2 PM' or 'Book an appointment for Friday at 10 AM'. Available meeting types include consultation, application help, account review, and general inquiries."
  } else if (lowerMessage.includes('heloc') || lowerMessage.includes('credit card')) {
    response = "The Aven HELOC Credit Card allows homeowners to access their home equity with credit limits up to $250,000. It offers variable interest rates from 7.99% to 15.49%, plus 2% cashback on all purchases and 7% cashback on travel booked through Aven's portal. There's no annual fee and approval can be as fast as 5 minutes."
  } else if (lowerMessage.includes('interest rate') || lowerMessage.includes('apr')) {
    response = "The Aven HELOC Credit Card offers variable interest rates from 7.99% to 15.49%, with a maximum of 18% during the life of the account. There's also a 0.25% autopay discount available to help you save even more."
  } else if (lowerMessage.includes('cashback') || lowerMessage.includes('rewards')) {
    response = "Aven offers 2% cashback on all purchases and 7% cashback on travel bookings made through Aven's travel portal. There are no annual fees, so you keep more of what you earn."
  } else if (lowerMessage.includes('apply') || lowerMessage.includes('eligibility')) {
    response = "To be eligible for the Aven HELOC Credit Card, you must be a homeowner with sufficient home equity, have a credit score typically around 600 or higher, and meet stable income requirements of usually $50,000 or more annually. The application process is quick, with approval decisions as fast as 5 minutes."
  } else {
    response += "I can help you with questions about Aven's HELOC Credit Card, including features, interest rates, cashback rewards, eligibility requirements, application process, and meeting scheduling. To enable full functionality with real-time data, please set up your API keys in the environment variables."
  }
  
  return response
}