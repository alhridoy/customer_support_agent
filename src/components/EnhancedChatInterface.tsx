'use client'

import { useState, useRef, useEffect } from 'react'
import { ChatMessage } from '@/types'
import { AgentStep, SearchResult } from '@/types/agent'
import ReactMarkdown from 'react-markdown'
import AgentThinking from './AgentThinking'

export default function EnhancedChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hi! I\'m here to help you with questions about your Aven HELOC Credit Card and financial services. How can I assist you today?',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([])
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showAgentThinking, setShowAgentThinking] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, agentSteps])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setAgentSteps([])
    setSearchResults([])

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
      let finalAnswer = ''

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
                  setAgentSteps(data.data.steps || [])
                  setSearchResults(data.data.searchResults || [])
                  break

                case 'response':
                  finalAnswer = data.data.answer
                  const aiMessage: ChatMessage = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: finalAnswer,
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
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I\'m having trouble connecting right now. Please try again later.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    })
  }

  const formatMessageWithCitations = (content: string, sources: string[]) => {
    return content
  }

  const getSourceTitle = (url: string) => {
    if (url.includes('aven.com')) {
      if (url.includes('support')) return 'Aven Customer Support'
      if (url.includes('eligibility')) return 'Aven Eligibility Requirements'
      if (url.includes('apply')) return 'Aven Application Process'
      if (url.includes('compare')) return 'Aven vs Traditional Credit Cards'
      return 'Aven HELOC Credit Card Information'
    }
    return url
  }

  return (
    <div className="flex flex-col h-[700px]">
      {/* Agent Thinking Panel */}
      {(isLoading || agentSteps.length > 0) && (
        <div className="mb-4">
          <AgentThinking
            isThinking={isLoading}
            steps={agentSteps}
            searchResults={searchResults}
            isExpanded={showAgentThinking}
            onToggle={() => setShowAgentThinking(!showAgentThinking)}
          />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((message) => (
          <div key={message.id} className="flex items-start gap-4">
            {/* Avatar */}
            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
              message.role === 'assistant' 
                ? 'bg-teal-400 text-white' 
                : 'bg-red-400 text-white'
            }`}>
              {message.role === 'assistant' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )}
            </div>

            {/* Message Content */}
            <div className="flex-1 min-w-0">
              <div className="bg-gray-50 rounded-xl p-4 max-w-3xl">
                <div className="text-gray-800 leading-relaxed prose prose-sm max-w-none">
                  {message.role === 'assistant' ? (
                    <ReactMarkdown
                      components={{
                        h1: ({children}) => <h1 className="text-lg font-semibold text-gray-800 mb-2">{children}</h1>,
                        h2: ({children}) => <h2 className="text-base font-semibold text-gray-800 mb-2 mt-3">{children}</h2>,
                        h3: ({children}) => <h3 className="text-sm font-semibold text-gray-800 mb-1 mt-2">{children}</h3>,
                        ul: ({children}) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
                        ol: ({children}) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
                        li: ({children}) => <li className="text-gray-700">{children}</li>,
                        p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                        strong: ({children}) => <strong className="font-semibold text-gray-800">{children}</strong>,
                        code: ({children}) => <code className="bg-gray-200 px-1 py-0.5 rounded text-sm font-mono">{children}</code>,
                        a: ({href, children}) => (
                          <a 
                            href={href} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline"
                          >
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {formatMessageWithCitations(message.content, message.sources || [])}
                    </ReactMarkdown>
                  ) : (
                    <p>{message.content}</p>
                  )}
                </div>
                
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <p className="text-xs font-medium text-gray-600 mb-2">📚 Sources:</p>
                    <div className="grid gap-2">
                      {message.sources.map((source, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <span className="text-xs text-gray-500 mt-0.5">[{index + 1}]</span>
                          <a
                            href={source}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex-1"
                          >
                            {getSourceTitle(source)}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Timestamp */}
              <p className="text-xs text-gray-500 mt-2 ml-4">
                {formatTime(message.timestamp)}
              </p>
            </div>
          </div>
        ))}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Section */}
      <div className="border-t border-gray-100 p-6 bg-white">
        <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about Aven..."
            className="flex-1 bg-transparent border-none outline-none text-gray-800 placeholder-gray-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="flex-shrink-0 w-10 h-10 bg-red-400 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        
        {/* Status indicator */}
        <div className="flex items-center gap-2 mt-3">
          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
          <span className="text-xs text-gray-500">Enhanced AI with agent thinking!</span>
        </div>
      </div>
    </div>
  )
}
