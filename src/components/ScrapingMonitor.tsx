'use client'

import { useState, useEffect } from 'react'

interface ScrapingProgress {
  status: string
  startTime: string | null
  itemsProcessed: number
  totalEstimated: number
  currentTask: string
  errors: string[]
}

interface ScrapingStatus {
  inProgress: boolean
  progress: ScrapingProgress
}

export default function ScrapingMonitor() {
  const [status, setStatus] = useState<ScrapingStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [logs, setLogs] = useState<string[]>([])

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/scrape')
      const data = await response.json()
      setStatus(data)
    } catch (error) {
      console.error('Error fetching scraping status:', error)
    }
  }

  const startScraping = async (comprehensive = false, mode = 'full') => {
    setIsLoading(true)
    setLogs(prev => [...prev, `🚀 Starting ${comprehensive ? 'comprehensive' : 'targeted'} scraping...`])
    
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comprehensive, mode }),
      })

      const result = await response.json()
      
      if (result.success) {
        setLogs(prev => [...prev, `✅ Scraping completed: ${result.message}`])
        setLogs(prev => [...prev, `📊 Items processed: ${result.itemCount}`])
        setLogs(prev => [...prev, `⏱️ Duration: ${result.duration}s`])
      } else {
        setLogs(prev => [...prev, `❌ Scraping failed: ${result.error}`])
      }
    } catch (error) {
      setLogs(prev => [...prev, `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`])
    } finally {
      setIsLoading(false)
      fetchStatus()
    }
  }

  const clearLogs = () => {
    setLogs([])
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 2000) // Poll every 2 seconds
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Aven Content Scraping Monitor</h2>
        <button
          onClick={fetchStatus}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Refresh Status
        </button>
      </div>

      {/* Status Display */}
      {status && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <span className="text-sm text-gray-600">Status:</span>
              <div className={`font-semibold ${
                status.inProgress ? 'text-yellow-600' : 
                status.progress.status === 'completed' ? 'text-green-600' : 
                status.progress.status === 'error' ? 'text-red-600' : 'text-gray-600'
              }`}>
                {status.inProgress ? '🔄 In Progress' : 
                 status.progress.status === 'completed' ? '✅ Completed' :
                 status.progress.status === 'error' ? '❌ Error' : '⏸️ Idle'}
              </div>
            </div>
            
            <div>
              <span className="text-sm text-gray-600">Items Processed:</span>
              <div className="font-semibold">{status.progress.itemsProcessed}</div>
            </div>
            
            <div>
              <span className="text-sm text-gray-600">Current Task:</span>
              <div className="font-semibold text-sm">{status.progress.currentTask || 'None'}</div>
            </div>
            
            <div>
              <span className="text-sm text-gray-600">Errors:</span>
              <div className="font-semibold text-red-600">{status.progress.errors.length}</div>
            </div>
          </div>

          {status.progress.startTime && (
            <div className="text-sm text-gray-600">
              Started: {new Date(status.progress.startTime).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {/* Control Buttons */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => startScraping(false)}
            disabled={isLoading || status?.inProgress}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            🎯 Start Targeted Scraping
          </button>
          
          <button
            onClick={() => startScraping(true)}
            disabled={isLoading || status?.inProgress}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            🌐 Start Comprehensive Scraping
          </button>
          
          <button
            onClick={() => startScraping(true, 'comprehensive-only')}
            disabled={isLoading || status?.inProgress}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            🔍 Comprehensive Only
          </button>
        </div>
        
        <div className="text-sm text-gray-600">
          <p><strong>Targeted:</strong> ~30 search queries, focused content (~200 pages)</p>
          <p><strong>Comprehensive:</strong> Targeted + broad site search (~500+ pages)</p>
          <p><strong>Comprehensive Only:</strong> Just the broad site search (~300+ pages)</p>
        </div>
      </div>

      {/* Logs Display */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-800">Activity Logs</h3>
          <button
            onClick={clearLogs}
            className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            Clear Logs
          </button>
        </div>
        
        <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm h-64 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-gray-500">No activity logs yet...</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="mb-1">
                [{new Date().toLocaleTimeString()}] {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Error Display */}
      {status?.progress.errors && status.progress.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="text-red-800 font-semibold mb-2">Errors:</h4>
          <ul className="text-red-700 text-sm space-y-1">
            {status.progress.errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
