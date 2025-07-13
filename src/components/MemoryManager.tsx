'use client'

import { useState } from 'react'

interface MemoryManagerProps {
  sessionId: string
}

export default function MemoryManager({ sessionId }: MemoryManagerProps) {
  const [showMemory, setShowMemory] = useState(false)
  const [memories, setMemories] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadMemories = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/memory?userId=${sessionId}`)
      const data = await response.json()
      setMemories(data.memories || [])
    } catch (error) {
      console.error('Error loading memories:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const clearMemories = async () => {
    if (!confirm('Are you sure you want to clear all conversation memory? This cannot be undone.')) {
      return
    }

    try {
      const response = await fetch('/api/memory', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: sessionId }),
      })

      if (response.ok) {
        setMemories([])
        alert('Conversation memory cleared successfully!')
      } else {
        alert('Failed to clear memory')
      }
    } catch (error) {
      console.error('Error clearing memories:', error)
      alert('Error clearing memory')
    }
  }

  const toggleMemory = () => {
    setShowMemory(!showMemory)
    if (!showMemory && memories.length === 0) {
      loadMemories()
    }
  }

  return (
    <div className="border-t border-gray-100 bg-gray-50">
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs text-gray-600">Memory: Enabled</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMemory}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            {showMemory ? 'Hide' : 'View'} Memory
          </button>
          <button
            onClick={clearMemories}
            className="text-xs text-red-600 hover:text-red-800 underline"
          >
            Clear Memory
          </button>
        </div>
      </div>

      {showMemory && (
        <div className="border-t border-gray-200 p-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-800">Conversation Memory</h3>
            <button
              onClick={loadMemories}
              disabled={isLoading}
              className="text-xs text-gray-600 hover:text-gray-800 underline disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-2">
            {memories.length === 0 ? (
              <p className="text-xs text-gray-500 italic">
                {isLoading ? 'Loading memories...' : 'No conversation memories found.'}
              </p>
            ) : (
              memories.map((memory, index) => (
                <div key={index} className="bg-gray-50 rounded p-2">
                  <p className="text-xs text-gray-700 line-clamp-2">
                    {memory.text || memory.content}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(memory.created_at || memory.timestamp).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="mt-3 text-xs text-gray-500">
            <p>💡 The AI remembers your preferences and past conversations to provide more personalized responses.</p>
          </div>
        </div>
      )}
    </div>
  )
}
