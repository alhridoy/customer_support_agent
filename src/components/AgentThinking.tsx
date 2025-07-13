'use client'

import { useState, useEffect } from 'react'
import { AgentStep, SearchResult } from '@/types/agent'

interface AgentThinkingProps {
  isThinking: boolean
  steps: AgentStep[]
  searchResults: SearchResult[]
  isExpanded?: boolean
  onToggle?: () => void
}

export default function AgentThinking({ 
  isThinking, 
  steps, 
  searchResults, 
  isExpanded = false, 
  onToggle 
}: AgentThinkingProps) {
  const [localExpanded, setLocalExpanded] = useState(isExpanded)

  const handleToggle = () => {
    const newExpanded = !localExpanded
    setLocalExpanded(newExpanded)
    onToggle?.()
  }

  const currentStep = steps.find(step => step.status === 'active')
  const completedSteps = steps.filter(step => step.status === 'complete')
  const progress = steps.length > 0 ? (completedSteps.length / steps.length) * 100 : 0

  const getStepIcon = (step: AgentStep) => {
    switch (step.step) {
      case 'analyzing':
        return '🔍'
      case 'searching_memory':
        return '🧠'
      case 'searching_knowledge':
        return '📚'
      case 'reranking':
        return '📊'
      case 'assembling':
        return '🔧'
      case 'generating':
        return '✨'
      case 'complete':
        return '✅'
      default:
        return '⚪'
    }
  }

  const getStepColor = (status: string) => {
    switch (status) {
      case 'complete':
        return 'text-green-600 bg-green-50'
      case 'active':
        return 'text-blue-600 bg-blue-50'
      case 'error':
        return 'text-red-600 bg-red-50'
      default:
        return 'text-gray-400 bg-gray-50'
    }
  }

  if (!isThinking && steps.length === 0) return null

  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-sm">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={handleToggle}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            {isThinking ? (
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900">
              {isThinking ? 'Agent is thinking...' : 'Analysis complete'}
            </h3>
            <p className="text-sm text-gray-500">
              {currentStep ? currentStep.description : 
               steps.length > 0 ? `Completed ${completedSteps.length} of ${steps.length} steps` : 
               'Ready to analyze your query'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isThinking && (
            <div className="text-sm text-gray-500">
              {Math.round(progress)}%
            </div>
          )}
          <svg 
            className={`w-5 h-5 text-gray-400 transition-transform ${localExpanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Progress Bar */}
      {isThinking && (
        <div className="px-4 pb-2">
          <div className="w-full bg-gray-200 rounded-full h-1">
            <div 
              className="bg-blue-600 h-1 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Expanded Content */}
      {localExpanded && (
        <div className="border-t border-gray-100">
          {/* Steps Timeline */}
          {steps.length > 0 && (
            <div className="p-4 space-y-3">
              <h4 className="font-medium text-gray-900 mb-3">Processing Steps</h4>
              <div className="space-y-2">
                {steps.map((step, index) => (
                  <div key={step.id} className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${getStepColor(step.status)}`}>
                      {step.status === 'active' ? (
                        <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        getStepIcon(step)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{step.title}</p>
                        <span className="text-xs text-gray-500">
                          {step.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{step.description}</p>
                      
                      {/* Step Results */}
                      {step.results && step.results.length > 0 && (
                        <div className="mt-2 text-xs text-gray-500">
                          Found {step.results.length} results
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search Results Preview */}
          {searchResults.length > 0 && (
            <div className="border-t border-gray-100 p-4">
              <h4 className="font-medium text-gray-900 mb-3">
                Documents Analyzed ({searchResults.length})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {searchResults.map((result, index) => (
                  <div key={result.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                            {result.type}
                          </span>
                          <span className="text-xs text-gray-500">
                            Score: {(result.score * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="font-medium text-sm text-gray-900 truncate">
                          {result.title}
                        </p>
                        <p className="text-xs text-gray-600 line-clamp-2">
                          {result.content}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
