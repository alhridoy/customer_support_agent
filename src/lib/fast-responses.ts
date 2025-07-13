import { RAGResponse } from '@/types'

// Pre-computed responses for common questions to achieve sub-second response times
export const INSTANT_RESPONSES: Record<string, RAGResponse> = {
  // Interest rate questions
  'what are the interest rates': {
    answer: "Aven offers variable interest rates from 7.99% to 15.49% APR on the HELOC Credit Card, with a maximum rate of 18% during the life of the account. You can also get a 0.25% autopay discount.",
    sources: [{
      id: 'rates',
      title: 'Interest Rates',
      content: 'Current HELOC Credit Card rates',
      url: 'https://www.aven.com/rates',
      category: 'rates'
    }],
    confidence: 0.95
  },
  
  'interest rate': {
    answer: "Our HELOC Credit Card has variable rates from 7.99% to 15.49% APR with a 0.25% autopay discount available.",
    sources: [{
      id: 'rates',
      title: 'Interest Rates',
      content: 'HELOC Credit Card interest rates',
      url: 'https://www.aven.com/rates',
      category: 'rates'
    }],
    confidence: 0.95
  },

  // Credit limit questions
  'credit limit': {
    answer: "The Aven HELOC Credit Card offers credit limits up to $250,000, based on your home equity and creditworthiness.",
    sources: [{
      id: 'limits',
      title: 'Credit Limits',
      content: 'HELOC Credit Card limits',
      url: 'https://www.aven.com/limits',
      category: 'limits'
    }],
    confidence: 0.95
  },

  'how much can i borrow': {
    answer: "You can borrow up to $250,000 with the Aven HELOC Credit Card, depending on your available home equity and qualification criteria.",
    sources: [{
      id: 'limits',
      title: 'Borrowing Limits',
      content: 'Maximum borrowing amounts',
      url: 'https://www.aven.com/limits',
      category: 'limits'
    }],
    confidence: 0.95
  },

  // Cashback questions
  'cashback': {
    answer: "Earn 2% cashback on all purchases and 7% cashback on travel bookings made through Aven's travel portal. No annual fee.",
    sources: [{
      id: 'rewards',
      title: 'Cashback Rewards',
      content: 'HELOC Credit Card rewards program',
      url: 'https://www.aven.com/rewards',
      category: 'rewards'
    }],
    confidence: 0.95
  },

  'rewards': {
    answer: "Get 2% cashback on all purchases and 7% cashback on travel with the Aven HELOC Credit Card. No annual fees or caps.",
    sources: [{
      id: 'rewards',
      title: 'Rewards Program',
      content: 'Cashback and travel rewards',
      url: 'https://www.aven.com/rewards',
      category: 'rewards'
    }],
    confidence: 0.95
  },

  // Application questions
  'how to apply': {
    answer: "Apply online for the Aven HELOC Credit Card in minutes. You'll need proof of homeownership, income verification, and basic personal information. Approval decisions in as fast as 5 minutes.",
    sources: [{
      id: 'apply',
      title: 'Application Process',
      content: 'How to apply for HELOC Credit Card',
      url: 'https://www.aven.com/apply',
      category: 'application'
    }],
    confidence: 0.95
  },

  'eligibility': {
    answer: "To qualify: be a homeowner with available equity, credit score typically 600+, stable income usually $50k+ annually, and meet debt-to-income requirements.",
    sources: [{
      id: 'eligibility',
      title: 'Eligibility Requirements',
      content: 'HELOC Credit Card qualification criteria',
      url: 'https://www.aven.com/eligibility',
      category: 'eligibility'
    }],
    confidence: 0.95
  },

  // General product questions
  'what is aven': {
    answer: "Aven is a fintech company offering the HELOC Credit Card, which lets homeowners access their home equity through a convenient credit card with competitive rates and cashback rewards.",
    sources: [{
      id: 'about',
      title: 'About Aven',
      content: 'Company overview and products',
      url: 'https://www.aven.com/about',
      category: 'general'
    }],
    confidence: 0.95
  },

  'heloc credit card': {
    answer: "The Aven HELOC Credit Card combines home equity access with credit card convenience. Get up to $250,000 credit limit, 7.99-15.49% variable rates, 2% cashback on purchases, 7% on travel, no annual fee.",
    sources: [{
      id: 'product',
      title: 'HELOC Credit Card',
      content: 'Product overview and features',
      url: 'https://www.aven.com/heloc-credit-card',
      category: 'product'
    }],
    confidence: 0.95
  }
}

export function getInstantResponse(message: string): RAGResponse | null {
  const cleanMessage = message.toLowerCase().trim()
  
  // Exact match first
  if (INSTANT_RESPONSES[cleanMessage]) {
    return INSTANT_RESPONSES[cleanMessage]
  }
  
  // Fuzzy matching for common variations
  for (const [key, response] of Object.entries(INSTANT_RESPONSES)) {
    if (cleanMessage.includes(key) || key.includes(cleanMessage)) {
      return response
    }
  }
  
  return null
}