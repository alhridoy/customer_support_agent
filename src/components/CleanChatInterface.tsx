'use client'

import { useState, useRef, useEffect } from 'react'
import { ChatMessage } from '@/types'
import { AgentStep, SearchResult } from '@/types/agent'

interface ThinkingSection {
  id: string
  title: string
  status: 'idle' | 'active' | 'complete'
  items: string[]
  isExpanded: boolean
}

export default function CleanChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [thinkingSections, setThinkingSections] = useState<ThinkingSection[]>([
    { id: 'searching', title: 'Searching', status: 'idle', items: [], isExpanded: false },
    { id: 'reading', title: 'Reading', status: 'idle', items: [], isExpanded: false },
    { id: 'analyzing', title: 'Analyzing', status: 'idle', items: [], isExpanded: false }
  ])
  const [sources, setSources] = useState<any[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const updateThinkingSection = (sectionId: string, status: 'idle' | 'active' | 'complete', items: string[] = [], expand = false) => {
    setThinkingSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, status, items, isExpanded: expand || section.isExpanded }
        : section
    ))
  }

  const toggleSection = (sectionId: string) => {
    setThinkingSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, isExpanded: !section.isExpanded }
        : section
    ))
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setCurrentQuestion(input)
    setInput('')
    setIsLoading(true)
    setSources([])

    // Reset thinking sections
    setThinkingSections([
      { id: 'searching', title: 'Searching', status: 'idle', items: [], isExpanded: false },
      { id: 'reading', title: 'Reading', status: 'idle', items: [], isExpanded: false },
      { id: 'analyzing', title: 'Analyzing', status: 'idle', items: [], isExpanded: false }
    ])

    try {
      const response = await fetch('/api/chat-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          sessionId,
          userId: 'anonymous'
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              switch (data.type) {
                case 'progress':
                  const steps = data.data.steps || []
                  const searchResults = data.data.searchResults || []

                  // Update sections based on current step
                  const currentStep = steps.find((s: AgentStep) => s.status === 'active')
                  
                  if (currentStep) {
                    switch (currentStep.step) {
                      case 'analyzing':
                        updateThinkingSection('searching', 'idle')
                        updateThinkingSection('reading', 'idle')
                        updateThinkingSection('analyzing', 'active')
                        break
                      case 'searching_memory':
                      case 'searching_knowledge':
                        updateThinkingSection('searching', 'active', [
                          'What are the evaluation metrics used to assess AI...',
                          'evaluation metrics artificial intelligence perfor...',
                          'AI agent benchmarking methods and frameworks',
                          'quantitative assessment KPIs machine learning mod...'
                        ], true)
                        break
                      case 'reranking':
                        updateThinkingSection('searching', 'complete', [
                          'What are the evaluation metrics used to assess AI...',
                          'evaluation metrics artificial intelligence perfor...',
                          'AI agent benchmarking methods and frameworks',
                          'quantitative assessment KPIs machine learning mod...'
                        ])
                        updateThinkingSection('reading', 'active', [
                          '📄 aven_heloc_overview.pdf',
                          '📄 aven_eligibility_requirements.pdf'
                        ], true)
                        break
                      case 'assembling':
                        updateThinkingSection('reading', 'complete', [
                          '📄 aven_heloc_overview.pdf',
                          '📄 aven_eligibility_requirements.pdf'
                        ])
                        updateThinkingSection('analyzing', 'active', [], true)
                        break
                    }
                  }

                  // Set sources
                  if (searchResults.length > 0) {
                    setSources(searchResults.slice(0, 6))
                  }
                  break

                case 'response':
                  updateThinkingSection('analyzing', 'complete')
                  
                  const aiMessage: ChatMessage = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: data.data.answer,
                    timestamp: new Date(),
                    sources: data.data.sources?.map((s: any) => s.url) || [],
                  }
                  setMessages(prev => [...prev, aiMessage])
                  break

                case 'complete':
                  setIsLoading(false)
                  break

                case 'error':
                  throw new Error(data.data.error)
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const getStatusIcon = (status: 'idle' | 'active' | 'complete') => {
    switch (status) {
      case 'active':
        return (
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        )
      case 'complete':
        return (
          <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )
      default:
        return <div className="w-4 h-4 bg-gray-300 rounded-full"></div>
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Aven Support</h1>
        <div className="bg-gray-200 px-3 py-1 rounded-full text-sm text-gray-600">
          AI Evals
        </div>
      </div>

      {/* Main Question Section */}
      {(isLoading || currentQuestion) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-gray-900">
                    {currentQuestion || "Processing your question..."}
                  </h2>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Thinking Sections */}
                <div className="mt-4 space-y-4">
                  {thinkingSections.map((section) => (
                    <div key={section.id}>
                      <div 
                        className="flex items-center gap-3 cursor-pointer"
                        onClick={() => toggleSection(section.id)}
                      >
                        {getStatusIcon(section.status)}
                        <span className="font-medium text-gray-700">{section.title}</span>
                        {section.status === 'active' && (
                          <span className="text-sm text-gray-500">...</span>
                        )}
                      </div>
                      
                      {section.isExpanded && section.items.length > 0 && (
                        <div className="ml-7 mt-2 space-y-2">
                          {section.items.map((item, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <div className="w-4 h-4 bg-gray-100 rounded flex items-center justify-center">
                                <span className="text-xs text-gray-600">
                                  {section.id === 'reading' ? '📄' : '🔍'}
                                </span>
                              </div>
                              <span className="text-sm text-gray-600">{item}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="space-y-4 mb-6">
        {messages.map((message) => (
          <div key={message.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                message.role === 'assistant' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
              }`}>
                {message.role === 'assistant' ? '🤖' : '👤'}
              </div>
              <div className="flex-1">
                <div className="prose prose-sm max-w-none text-gray-800">
                  {message.content}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sources */}
      {sources.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sources</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sources.map((source, index) => (
              <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                    <span className="text-blue-600 text-sm">📄</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 text-sm line-clamp-2">
                      {source.title}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {source.content}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                        {source.type}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="sticky bottom-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Message Aven assistant..."
              className="flex-1 border-none outline-none text-gray-800 placeholder-gray-500"
              disabled={isLoading}
            />
            <div className="flex items-center gap-2">
              <button className="p-2 text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              <select className="text-sm border-none bg-orange-100 text-orange-700 rounded px-2 py-1">
                <option>Claude 3.5 Sonnet</option>
              </select>
              <button className="p-2 text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
                </svg>
              </button>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-600">Agent</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div ref={messagesEndRef} />
    </div>
  )
}
