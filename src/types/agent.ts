export interface AgentStep {
  id: string
  step: 'analyzing' | 'searching_memory' | 'searching_knowledge' | 'reranking' | 'assembling' | 'generating' | 'complete'
  title: string
  description: string
  status: 'pending' | 'active' | 'complete' | 'error'
  timestamp: Date
  details?: any
  results?: any[]
}

export interface SearchResult {
  id: string
  title: string
  content: string
  source: string
  score: number
  type: 'memory' | 'knowledge' | 'web'
}

export interface AgentState {
  currentStep: string
  steps: AgentStep[]
  searchResults: SearchResult[]
  isThinking: boolean
  progress: number
}

export interface StreamingResponse {
  type: 'step_update' | 'search_results' | 'final_response'
  data: any
}
