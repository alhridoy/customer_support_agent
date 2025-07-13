'use client'

import { useState } from 'react'
import SimpleChatInterface from '@/components/SimpleChatInterface'
import VoiceInterface from '@/components/VoiceInterface'

export default function Home() {
  const [activeMode, setActiveMode] = useState<'chat' | 'voice'>('chat')

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900 opacity-50"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(120,119,198,0.1),transparent_50%)]"></div>
      
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 text-center pt-16 pb-8">
          <h1 className="text-6xl font-light text-white mb-4 tracking-wide">
            aven
          </h1>
          <p className="text-gray-400 text-lg font-light max-w-md mx-auto">
            AI-powered customer support for your HELOC journey
          </p>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-16">
          <div className="w-full max-w-4xl">
            
            {/* Mode Selection */}
            <div className="flex justify-center mb-8">
              <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-full p-1.5 shadow-2xl">
                <button
                  className={`px-6 py-3 rounded-full font-medium transition-all duration-300 flex items-center gap-2 text-sm ${
                    activeMode === 'chat'
                      ? 'bg-white text-black shadow-lg'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                  onClick={() => setActiveMode('chat')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-4.126-.98L3 20l1.98-5.874A8.955 8.955 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
                  </svg>
                  Chat
                </button>
                <button
                  className={`px-6 py-3 rounded-full font-medium transition-all duration-300 flex items-center gap-2 text-sm ${
                    activeMode === 'voice'
                      ? 'bg-white text-black shadow-lg'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                  onClick={() => setActiveMode('voice')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  Voice
                </button>
              </div>
            </div>

            {/* Interface Container */}
            <div className="bg-gray-900/30 backdrop-blur-md border border-gray-800/50 rounded-3xl shadow-2xl overflow-hidden">
              {activeMode === 'chat' ? <SimpleChatInterface /> : <VoiceInterface />}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}