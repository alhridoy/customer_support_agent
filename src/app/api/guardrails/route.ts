import { NextRequest, NextResponse } from 'next/server'
import { GuardrailCheck } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json()

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    const check = await checkMessageGuardrails(message)
    return NextResponse.json(check)
  } catch (error) {
    console.error('Error in guardrails API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function checkMessageGuardrails(message: string): Promise<GuardrailCheck> {
  const lowerMessage = message.toLowerCase()

  // Check for personal data requests
  const personalDataPatterns = [
    /social security|ssn|account number|password|pin|routing number/,
    /credit score|income|balance|payment history|transaction/,
    /personal information|address|phone number|email/
  ]

  for (const pattern of personalDataPatterns) {
    if (pattern.test(lowerMessage)) {
      return {
        isBlocked: true,
        reason: 'Request contains personal data',
        category: 'personal_data'
      }
    }
  }

  // Check for legal advice requests
  const legalAdvicePatterns = [
    /legal advice|lawsuit|sue|attorney|lawyer|legal rights/,
    /breach of contract|violation|illegal|fraud|scam/
  ]

  for (const pattern of legalAdvicePatterns) {
    if (pattern.test(lowerMessage)) {
      return {
        isBlocked: true,
        reason: 'Request asks for legal advice',
        category: 'legal_advice'
      }
    }
  }

  // Check for financial advice requests
  const financialAdvicePatterns = [
    /should i invest|investment advice|financial planning|tax advice/,
    /bankruptcy|debt consolidation|credit repair|loan modification/
  ]

  for (const pattern of financialAdvicePatterns) {
    if (pattern.test(lowerMessage)) {
      return {
        isBlocked: true,
        reason: 'Request asks for financial advice',
        category: 'financial_advice'
      }
    }
  }

  // Check for toxicity
  const toxicityPatterns = [
    /hate|stupid|idiot|terrible|worst|scam|fraud/,
    /\b(damn|hell|shit)\b/
  ]

  for (const pattern of toxicityPatterns) {
    if (pattern.test(lowerMessage)) {
      return {
        isBlocked: true,
        reason: 'Message contains inappropriate language',
        category: 'toxicity'
      }
    }
  }

  return { isBlocked: false }
}
