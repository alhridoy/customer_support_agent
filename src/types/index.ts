export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  sources?: string[]
}

export interface AvenKnowledgeItem {
  id: string
  title: string
  content: string
  url: string
  category: string
  embedding?: number[]
}

export interface RAGResponse {
  answer: string
  sources: AvenKnowledgeItem[]
  confidence: number
  steps?: any[]
  searchResults?: any[]
  traceId?: string
}

export interface VapiConfig {
  publicKey: string
  assistantId: string
}

export interface GuardrailCheck {
  isBlocked: boolean
  reason?: string
  category?: 'personal_data' | 'legal_advice' | 'financial_advice' | 'toxicity'
}

export interface MeetingRequest {
  date: string
  time: string
  purpose: string
  contactInfo: {
    name: string
    email: string
    phone?: string
  }
}

export interface EvaluationQuestion {
  id: string
  question: string
  expectedAnswer: string
  category: string
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface EvaluationResult {
  questionId: string
  accuracy: number
  helpfulness: number
  citationQuality: number
  response: string
  sources: string[]
}
