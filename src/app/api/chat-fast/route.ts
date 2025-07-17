import { NextRequest, NextResponse } from 'next/server'
import { searchKnowledgeBase } from '@/lib/pinecone'
import { generateResponse } from '@/lib/openai'
import { addToMemory, getMemoryContext } from '@/lib/memory'
import { RAGResponse } from '@/types'
import { getInstantResponse } from '@/lib/fast-responses'

// TODO: Replace with Redis for production horizontal scaling
// In-memory cache is not suitable for multi-instance deployments
// Each instance maintains separate cache state, leading to cache misses
const responseCache = new Map<string, { response: RAGResponse; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes cache

// Production Redis implementation would look like:
// import Redis from 'ioredis'
// const redis = new Redis(process.env.REDIS_URL)
// const getCachedResponse = async (key: string) => await redis.get(key)
// const setCachedResponse = async (key: string, value: string, ttl: number) => await redis.setex(key, ttl, value)

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now()
    console.log('🚀 Fast Chat API called')
    
    const { message, userId = 'anonymous', sessionId } = await request.json()
    console.log('📝 Message:', message)

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Check for instant responses first (fastest possible)
    const instantResponse = getInstantResponse(message)
    if (instantResponse) {
      console.log(`⚡ Instant response in ${Date.now() - startTime}ms`)
      return NextResponse.json(instantResponse)
    }

    // Check cache for exact matches
    const cacheKey = message.toLowerCase().trim()
    const cached = responseCache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log('⚡ Cache hit - returning cached response')
      return NextResponse.json(cached.response)
    }

    const effectiveUserId = userId === 'anonymous' ? `session_${sessionId || Date.now()}` : userId

    // Check if we have real API keys
    const hasRealKeys = process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('placeholder')
    
    if (!hasRealKeys) {
      const demoResponse = getFastDemoResponse(message)
      return NextResponse.json(demoResponse)
    }

    // Quick meeting check
    const meetingKeywords = ['schedule', 'appointment', 'meeting', 'book', 'reserve', 'consultation']
    const isSchedulingRequest = meetingKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    )

    if (isSchedulingRequest) {
      const result: RAGResponse = {
        answer: "I'd be happy to help you schedule a meeting! You can book a consultation with our team using our calendar link, or I can help you find the best time. What type of meeting would you like to schedule and when would work best for you?",
        sources: [],
        confidence: 0.9
      }
      return NextResponse.json(result)
    }

    // Parallel operations instead of sequential
    const [memoryContext, relevantDocs] = await Promise.all([
      getMemoryContext(message, effectiveUserId).catch(() => ''), // Don't fail if memory fails
      searchKnowledgeBase(message).catch(() => []) // Simple search, no agentic complexity
    ])

    console.log(`🔍 Found ${relevantDocs.length} relevant docs`)

    // Generate response
    const response = await generateResponse(message, relevantDocs, memoryContext)

    const result: RAGResponse = {
      answer: response,
      sources: relevantDocs,
      confidence: relevantDocs.length > 0 ? 0.8 : 0.5
    }

    // Cache the response for future use
    responseCache.set(cacheKey, { response: result, timestamp: Date.now() })

    // Store in memory asynchronously (don't wait for it)
    addToMemory([
      { role: 'user', content: message },
      { role: 'assistant', content: response }
    ], effectiveUserId, {
      category: 'aven_support',
      hasKnowledgeBase: relevantDocs.length > 0
    }).catch(console.error)

    const duration = Date.now() - startTime
    console.log(`⚡ Fast chat completed in ${duration}ms`)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in fast chat API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function getFastDemoResponse(message: string): RAGResponse {
  const lowerMessage = message.toLowerCase()
  
  let answer = "I'm the Aven AI Assistant. "
  
  if (lowerMessage.includes('heloc') || lowerMessage.includes('credit card')) {
    answer = "The Aven HELOC Credit Card lets homeowners access up to $250,000 in home equity with 7.99-15.49% variable rates, 2% cashback on purchases, 7% on travel, no annual fee, and 5-minute approval."
  } else if (lowerMessage.includes('interest rate') || lowerMessage.includes('apr')) {
    answer = "Aven offers variable interest rates from 7.99% to 15.49% with a 0.25% autopay discount available."
  } else if (lowerMessage.includes('cashback') || lowerMessage.includes('rewards')) {
    answer = "Get 2% cashback on all purchases and 7% cashback on travel with no annual fees."
  } else if (lowerMessage.includes('apply') || lowerMessage.includes('eligibility')) {
    answer = "To qualify: be a homeowner with equity, 600+ credit score, $50k+ income. Apply online with 5-minute approval."
  } else {
    answer += "I can help with HELOC Credit Card questions, rates, cashback, eligibility, and applications. How can I assist you?"
  }
  
  return {
    answer,
    sources: [{
      id: 'fast-demo',
      title: 'Aven HELOC Information',
      content: 'Quick demo response',
      url: 'https://www.aven.com',
      category: 'demo'
    }],
    confidence: 0.9
  }
}

// Clean up cache periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of responseCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      responseCache.delete(key)
    }
  }
}, 60000) // Clean every minute