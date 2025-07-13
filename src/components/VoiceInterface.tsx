'use client'

import { useState, useEffect } from 'react'
import { VapiConfig } from '@/types'

export default function VoiceInterface() {
  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [vapi, setVapi] = useState<any>(null)
  const [currentCallId, setCurrentCallId] = useState<string | null>(null)
  const [lastUserMessage, setLastUserMessage] = useState('')
  const [showSchedulePrompt, setShowSchedulePrompt] = useState(false)

  useEffect(() => {
    // Initialize Vapi when component mounts
    const initVapi = async () => {
      try {
        const { default: Vapi } = await import('@vapi-ai/web')
        
        const vapiInstance = new Vapi(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || '')
        
        // Set up event listeners
        vapiInstance.on('call-start', () => {
          console.log('Call started')
          const callId = `voice_call_${Date.now()}`
          setCurrentCallId(callId)
          setIsCallActive(true)
          setIsConnecting(false)
        })
        
        vapiInstance.on('call-end', () => {
          console.log('Call ended')
          setIsCallActive(false)
          setIsConnecting(false)
          
          // Show schedule prompt after call ends
          setShowSchedulePrompt(true)
          
          // Clean up any active voice traces
          if (currentCallId) {
            fetch('/api/voice/trace', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                callId: currentCallId
              })
            }).catch(console.error)
          }
          setCurrentCallId(null)
        })
        
        vapiInstance.on('message', (message: any) => {
          console.log('Vapi message:', message)
          console.log('Message type:', message.type)
          console.log('Message role:', message.role)
          console.log('Message content:', message.transcript || message.content)
          
          if (message.type === 'transcript' && message.transcript) {
            setTranscript(prev => prev + `\n${message.role}: ${message.transcript}`)
            
            // Trace voice interactions
            if (message.role === 'user' && message.transcript) {
              console.log('🎤 Tracing user message:', message.transcript)
              setLastUserMessage(message.transcript)
              
              // Log user message to our tracing endpoint
              fetch('/api/voice/trace', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'user_message',
                  transcript: message.transcript,
                  timestamp: new Date().toISOString(),
                  callId: currentCallId || message.call?.id || 'voice_call'
                })
              }).catch(console.error)
              
              // Set a timeout to auto-complete the trace if no assistant response comes
              setTimeout(() => {
                console.log('⏰ Auto-completing trace due to timeout...')
                fetch('/api/voice/trace', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    type: 'assistant_response',
                    transcript: `This is an auto-generated response for the question: "${message.transcript}". The actual assistant response was not captured properly from Vapi messages.`,
                    timestamp: new Date().toISOString(),
                    callId: currentCallId || 'voice_call'
                  })
                }).catch(console.error)
              }, 10000) // 10 second timeout
            } else if (message.role === 'assistant' && message.transcript) {
              console.log('🤖 Tracing assistant response:', message.transcript)
              // Log assistant response to our tracing endpoint
              fetch('/api/voice/trace', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'assistant_response',
                  transcript: message.transcript,
                  timestamp: new Date().toISOString(),
                  callId: currentCallId || message.call?.id || 'voice_call'
                })
              }).catch(console.error)
            }
          } else if (message.type === 'conversation-update') {
            console.log('📝 Conversation update:', message)
            
            // Check if this has assistant message
            if (message.conversation && message.conversation.messages) {
              const lastMessage = message.conversation.messages[message.conversation.messages.length - 1]
              if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content) {
                console.log('🤖 Tracing assistant from conversation update:', lastMessage.content)
                // Log assistant response from conversation update
                fetch('/api/voice/trace', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    type: 'assistant_response',
                    transcript: lastMessage.content,
                    timestamp: new Date().toISOString(),
                    callId: currentCallId || message.call?.id || 'voice_call'
                  })
                }).catch(console.error)
              }
            }
          } else if (message.type === 'function-call') {
            console.log('Function call:', message.functionCall)
          } else if (message.type === 'speech-update') {
            console.log('Speech update:', message)
            // Check if this contains assistant speech
            if (message.status === 'stopped' && message.role === 'assistant') {
              console.log('🤖 Assistant speech detected, trying to capture response...')
              // Try to get the response from the transcript so far
              const transcriptLines = transcript.split('\n')
              const lastAssistantLine = transcriptLines.reverse().find(line => line.startsWith('assistant:'))
              if (lastAssistantLine) {
                const assistantResponse = lastAssistantLine.replace('assistant:', '').trim()
                if (assistantResponse && assistantResponse.length > 0) {
                  console.log('🤖 Captured assistant response from transcript:', assistantResponse)
                  fetch('/api/voice/trace', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      type: 'assistant_response',
                      transcript: assistantResponse,
                      timestamp: new Date().toISOString(),
                      callId: currentCallId || 'voice_call'
                    })
                  }).catch(console.error)
                }
              }
            }
          } else {
            console.log('🔍 Unknown message type:', message.type, message)
          }
        })
        
        vapiInstance.on('error', (error: any) => {
          console.error('Vapi error:', error)
          setIsCallActive(false)
          setIsConnecting(false)
        })
        
        setVapi(vapiInstance)
      } catch (error) {
        console.error('Failed to initialize Vapi:', error)
      }
    }
    
    initVapi()
  }, [])

  const startCall = async () => {
    if (!vapi) return
    
    setIsConnecting(true)
    setTranscript('')
    setShowSchedulePrompt(false)
    
    try {
      await vapi.start(process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || '')
    } catch (error) {
      console.error('Failed to start call:', error)
      setIsConnecting(false)
    }
  }

  const endCall = () => {
    if (!vapi) return
    
    vapi.stop()
    setIsCallActive(false)
    setIsConnecting(false)
  }

  const handleScheduleMeeting = () => {
    // Open cal.com link in new tab
    window.open('https://cal.com/alhridoy/15min', '_blank')
    setShowSchedulePrompt(false)
  }

  const dismissSchedulePrompt = () => {
    setShowSchedulePrompt(false)
  }

  return (
    <div className="flex flex-col items-center py-16 px-8 h-[600px] relative">
      {/* Schedule Meeting Prompt Modal */}
      {showSchedulePrompt && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-md w-full mx-4 text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-teal-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="w-3 h-3 bg-gray-500 rounded-full mx-auto mb-4"></div>
              <p className="text-white text-sm mb-2">ended</p>
              <h3 className="text-white text-xl font-semibold mb-2">Aven Assistant</h3>
              <p className="text-gray-400 text-sm mb-6">
                Still not sure what plan is right for you? Speak with a member of our team
              </p>
            </div>
            
            <div className="space-y-3">
              <button 
                onClick={handleScheduleMeeting}
                className="w-full bg-teal-500 hover:bg-teal-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
              >
                Schedule
              </button>
              
              <button 
                onClick={dismissSchedulePrompt}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="text-center mb-12">
        <h2 className="text-2xl font-semibold text-gray-800 mb-3">Voice Assistant</h2>
        <p className="text-gray-600 text-lg max-w-md">
          Click the microphone to start a voice conversation with our AI assistant
        </p>
      </div>

      <div className="flex flex-col items-center space-y-8">
        <button
          onClick={isCallActive ? endCall : startCall}
          disabled={isConnecting}
          className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl transition-all duration-300 transform hover:scale-105 ${
            isCallActive
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg animate-pulse'
              : isConnecting
              ? 'bg-yellow-500 text-white cursor-not-allowed shadow-lg'
              : 'bg-green-500 hover:bg-green-600 text-white shadow-lg'
          }`}
        >
          {isConnecting ? (
            <div className="animate-spin rounded-full h-8 w-8 border-b-3 border-white"></div>
          ) : isCallActive ? (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>

        <div className="text-center">
          {isConnecting && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              <p className="text-yellow-600 font-medium">Connecting...</p>
            </div>
          )}
          {isCallActive && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <p className="text-green-600 font-medium">Call in progress</p>
            </div>
          )}
          {!isCallActive && !isConnecting && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <p className="text-gray-600">Ready to start voice chat</p>
            </div>
          )}
        </div>
      </div>

      {transcript && (
        <div className="w-full max-w-2xl mt-8 flex-1">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Live Conversation</h3>
          <div className="bg-gray-50 rounded-xl p-6 max-h-64 overflow-y-auto border border-gray-200">
            <pre className="text-sm whitespace-pre-wrap text-gray-700 leading-relaxed font-sans">
              {transcript}
            </pre>
          </div>
        </div>
      )}

      <div className="text-center text-sm text-gray-500 max-w-lg mt-8">
        <div className="flex items-center justify-center gap-2 mb-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">Tips for best experience:</span>
        </div>
        <p className="leading-relaxed">
          Allow microphone access when prompted. Speak clearly and naturally. 
          The AI can help with all your Aven HELOC Credit Card questions.
        </p>
      </div>
    </div>
  )
}
