import { RAGResponse, GuardrailCheck } from '@/types'
import { getInstantResponse } from './fast-responses'

export async function sendChatMessage(message: string, sessionId?: string, userId?: string, useFullPipeline?: boolean): Promise<RAGResponse> {
  try {
    const startTime = Date.now()
    
    // Always use full pipeline now - removed instant responses bypass
    // Full 6-step RAG pipeline provides better quality and observability
    
    // Check guardrails for non-instant responses
    const guardrailCheck = await checkGuardrails(message)
    if (guardrailCheck.isBlocked) {
      return {
        answer: getGuardrailResponse(guardrailCheck),
        sources: [],
        confidence: 1.0
      }
    }

    // Send to chat API
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        message,
        sessionId,
        userId: userId || 'anonymous',
        useFullPipeline
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to send message')
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error in sendChatMessage:', error)
    throw error
  }
}

async function checkGuardrails(message: string): Promise<GuardrailCheck> {
  try {
    const response = await fetch('/api/guardrails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    })

    if (!response.ok) {
      return { isBlocked: false }
    }

    return await response.json()
  } catch (error) {
    console.error('Error checking guardrails:', error)
    return { isBlocked: false }
  }
}

function getGuardrailResponse(check: GuardrailCheck): string {
  switch (check.category) {
    case 'personal_data':
      return "I can't help with personal data or account-specific information. For account questions, please log into your Aven account or contact customer service directly."
    case 'legal_advice':
      return "I can't provide legal advice. For legal questions about your Aven account or services, please consult with a qualified attorney or contact Aven's legal team."
    case 'financial_advice':
      return "I can provide general information about Aven's products but can't give personalized financial advice. Please consult with a financial advisor or contact Aven directly for specific financial guidance."
    case 'toxicity':
      return "I'm here to help with questions about Aven's services. Please keep our conversation respectful and on topic."
    default:
      return "I can't help with that request. Please ask me about Aven's HELOC Credit Card, services, or general account information."
  }
}
