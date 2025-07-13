'use client'

import { useState, useRef, useEffect } from 'react'
import { ChatMessage } from '@/types'
import { sendChatMessage } from '@/lib/chat'
import ReactMarkdown from 'react-markdown'
import MemoryManager from './MemoryManager'

export default function ChatInterface() {
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
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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

    try {
      const response = await sendChatMessage(input, sessionId)
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(),
        sources: response.sources?.map(s => s.url) || [],
      }
      setMessages(prev => [...prev, aiMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I\'m having trouble connecting right now. Please try again later.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
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
    // This function will be enhanced later to add inline citations
    // For now, just return the content
    return content
  }

  const getSourceTitle = (url: string) => {
    // Extract a meaningful title from the URL
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
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-3xl px-4 py-3 rounded-2xl ${
              message.role === 'assistant'
                ? 'bg-gray-100 text-gray-800'
                : 'bg-blue-500 text-white'
            }`}>
              <div className="leading-relaxed">
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
        
        {isLoading && (
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-teal-400 rounded-full flex items-center justify-center text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="bg-gray-50 rounded-xl p-4 max-w-3xl">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-400"></div>
                  <span className="text-gray-600">Thinking...</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Section */}
      <div className="border-t border-gray-100 p-6 bg-white">
        <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
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
          <span className="text-xs text-gray-500">AI is ready with memory!</span>
        </div>
      </div>
      
      {/* Memory Manager */}
      <MemoryManager sessionId={sessionId} />
    </div>
  )
}
