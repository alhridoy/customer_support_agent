import { RAGResponse, GuardrailCheck } from '@/types'
import { getInstantResponse } from './fast-responses'

export async function sendChatMessageFast(message: string, sessionId?: string, userId?: string): Promise<RAGResponse> {
  try {
    const startTime = Date.now()
    
    // Check for instant responses first (sub-second response)
    const instantResponse = getInstantResponse(message)
    if (instantResponse) {
      console.log(`⚡ Instant response in ${Date.now() - startTime}ms`)
      return instantResponse
    }
    
    // Quick guardrail check - only for obvious violations
    if (isObviousViolation(message)) {
      return {
        answer: "I'm here to help with questions about Aven's services. Please ask me about our HELOC Credit Card, rates, or application process.",
        sources: [],
        confidence: 1.0
      }
    }

    // Send to fast chat API
    const response = await fetch('/api/chat-fast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        message,
        sessionId,
        userId: userId || 'anonymous'
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to send message')
    }

    const data = await response.json()
    const duration = Date.now() - startTime
    console.log(`⚡ Fast chat response in ${duration}ms`)
    
    return data
  } catch (error) {
    console.error('Error in sendChatMessageFast:', error)
    
    // Fast fallback response
    return {
      answer: "I'm having trouble connecting right now. Please try asking about Aven's HELOC Credit Card, interest rates, cashback rewards, or application process.",
      sources: [],
      confidence: 0.5
    }
  }
}

function isObviousViolation(message: string): boolean {
  const lowerMessage = message.toLowerCase()
  const violations = [
    // Personal data requests
    'ssn', 'social security', 'account number', 'password', 'pin',
    // Inappropriate content
    'fuck', 'shit', 'damn', 'hell', 'bitch',
    // Unrelated requests  
    'recipe', 'weather', 'sports', 'politics', 'religion'
  ]
  
  return violations.some(violation => lowerMessage.includes(violation))
}