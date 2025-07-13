import { writeFileSync, readFileSync, existsSync } from 'fs'
import path from 'path'

export interface EvaluationTrace {
  id: string
  timestamp: Date
  sessionId?: string
  userId?: string
  userInput: string
  agentResponse: string
  sources: string[]
  metrics: {
    accuracy: number
    helpfulness: number
    citationQuality: number
    responseTime: number
  }
  guardrails: {
    contentModeration: any
    toxicityCheck: any
  }
  metadata: {
    model: string
    version: string
    category: string
    difficulty: string
  }
}

export interface EvaluationMetrics {
  totalInteractions: number
  averageAccuracy: number
  averageHelpfulness: number
  averageCitationQuality: number
  averageResponseTime: number
  guardrailsBlocked: number
  guardrailsBlockedRate: number
  categoryBreakdown: Record<string, {
    count: number
    avgAccuracy: number
    avgHelpfulness: number
  }>
}

class TelemetryService {
  private logFile: string
  private metricsFile: string

  constructor() {
    this.logFile = path.join(process.cwd(), 'eval-traces.jsonl')
    this.metricsFile = path.join(process.cwd(), 'eval-metrics.json')
  }

  logTrace(trace: EvaluationTrace): void {
    try {
      const logEntry = JSON.stringify(trace) + '\n'
      writeFileSync(this.logFile, logEntry, { flag: 'a' })
    } catch (error) {
      console.error('Error logging trace:', error)
    }
  }

  getTraces(limit?: number): EvaluationTrace[] {
    try {
      if (!existsSync(this.logFile)) return []
      
      const content = readFileSync(this.logFile, 'utf-8')
      const lines = content.trim().split('\n').filter(line => line.length > 0)
      
      const traces = lines.map(line => JSON.parse(line)).reverse()
      return limit ? traces.slice(0, limit) : traces
    } catch (error) {
      console.error('Error reading traces:', error)
      return []
    }
  }

  calculateMetrics(): EvaluationMetrics {
    const traces = this.getTraces()
    
    if (traces.length === 0) {
      return {
        totalInteractions: 0,
        averageAccuracy: 0,
        averageHelpfulness: 0,
        averageCitationQuality: 0,
        averageResponseTime: 0,
        guardrailsBlocked: 0,
        guardrailsBlockedRate: 0,
        categoryBreakdown: {}
      }
    }

    const totalInteractions = traces.length
    const averageAccuracy = traces.reduce((sum, t) => sum + t.metrics.accuracy, 0) / totalInteractions
    const averageHelpfulness = traces.reduce((sum, t) => sum + t.metrics.helpfulness, 0) / totalInteractions
    const averageCitationQuality = traces.reduce((sum, t) => sum + t.metrics.citationQuality, 0) / totalInteractions
    const averageResponseTime = traces.reduce((sum, t) => sum + t.metrics.responseTime, 0) / totalInteractions
    
    const guardrailsBlocked = traces.filter(t => 
      t.guardrails.contentModeration?.isBlocked || t.guardrails.toxicityCheck?.isBlocked
    ).length
    const guardrailsBlockedRate = guardrailsBlocked / totalInteractions

    // Category breakdown
    const categoryBreakdown: Record<string, { count: number; avgAccuracy: number; avgHelpfulness: number }> = {}
    
    traces.forEach(trace => {
      const category = trace.metadata.category
      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = { count: 0, avgAccuracy: 0, avgHelpfulness: 0 }
      }
      categoryBreakdown[category].count++
    })

    // Calculate averages for each category
    Object.keys(categoryBreakdown).forEach(category => {
      const categoryTraces = traces.filter(t => t.metadata.category === category)
      categoryBreakdown[category].avgAccuracy = 
        categoryTraces.reduce((sum, t) => sum + t.metrics.accuracy, 0) / categoryTraces.length
      categoryBreakdown[category].avgHelpfulness = 
        categoryTraces.reduce((sum, t) => sum + t.metrics.helpfulness, 0) / categoryTraces.length
    })

    const metrics: EvaluationMetrics = {
      totalInteractions,
      averageAccuracy,
      averageHelpfulness,
      averageCitationQuality,
      averageResponseTime,
      guardrailsBlocked,
      guardrailsBlockedRate,
      categoryBreakdown
    }

    // Save metrics to file
    try {
      writeFileSync(this.metricsFile, JSON.stringify(metrics, null, 2))
    } catch (error) {
      console.error('Error saving metrics:', error)
    }

    return metrics
  }

  generateDetailedReport(): string {
    const metrics = this.calculateMetrics()
    const traces = this.getTraces(10) // Last 10 traces for examples

    return `
# Aven AI Customer Support Agent - Comprehensive Evaluation Report

Generated: ${new Date().toISOString()}

## Overall Performance Metrics

- **Total Interactions**: ${metrics.totalInteractions}
- **Average Accuracy**: ${(metrics.averageAccuracy * 100).toFixed(1)}%
- **Average Helpfulness**: ${(metrics.averageHelpfulness * 100).toFixed(1)}%
- **Average Citation Quality**: ${(metrics.averageCitationQuality * 100).toFixed(1)}%
- **Average Response Time**: ${metrics.averageResponseTime.toFixed(0)}ms
- **Guardrails Triggered**: ${metrics.guardrailsBlocked} (${(metrics.guardrailsBlockedRate * 100).toFixed(1)}%)

## Performance by Category

${Object.entries(metrics.categoryBreakdown).map(([category, data]) => `
### ${category.toUpperCase()}
- **Interactions**: ${data.count}
- **Accuracy**: ${(data.avgAccuracy * 100).toFixed(1)}%
- **Helpfulness**: ${(data.avgHelpfulness * 100).toFixed(1)}%
`).join('')}

## Quality Thresholds Analysis

${metrics.averageAccuracy >= 0.8 ? '✅' : '❌'} **Accuracy Target** (≥80%): ${(metrics.averageAccuracy * 100).toFixed(1)}%
${metrics.averageHelpfulness >= 0.8 ? '✅' : '❌'} **Helpfulness Target** (≥80%): ${(metrics.averageHelpfulness * 100).toFixed(1)}%
${metrics.averageCitationQuality >= 0.6 ? '✅' : '❌'} **Citation Quality Target** (≥60%): ${(metrics.averageCitationQuality * 100).toFixed(1)}%
${metrics.guardrailsBlockedRate <= 0.05 ? '✅' : '❌'} **Guardrails Rate** (≤5%): ${(metrics.guardrailsBlockedRate * 100).toFixed(1)}%

## Recent Interaction Examples

${traces.slice(0, 5).map((trace, index) => `
### Example ${index + 1}
- **User**: ${trace.userInput}
- **Response**: ${trace.agentResponse.substring(0, 200)}${trace.agentResponse.length > 200 ? '...' : ''}
- **Accuracy**: ${(trace.metrics.accuracy * 100).toFixed(1)}%
- **Helpfulness**: ${(trace.metrics.helpfulness * 100).toFixed(1)}%
- **Sources**: ${trace.sources.length}
`).join('')}

## Recommendations

${metrics.averageAccuracy < 0.8 ? '🔧 **PRIORITY**: Improve response accuracy - consider expanding knowledge base' : ''}
${metrics.averageHelpfulness < 0.8 ? '🔧 **PRIORITY**: Enhance response helpfulness - focus on actionability and clarity' : ''}
${metrics.averageCitationQuality < 0.6 ? '🔧 Improve source citation quality and relevance' : ''}
${metrics.guardrailsBlockedRate > 0.05 ? '🔧 Review guardrails for false positives' : ''}
${metrics.averageResponseTime > 5000 ? '🔧 Optimize response time performance' : ''}

${metrics.averageAccuracy >= 0.8 && metrics.averageHelpfulness >= 0.8 ? '🎉 **EXCELLENT**: System performance meets high quality standards!' : ''}

---
*This report was automatically generated by the Aven AI Evaluation System*
`
  }

  clearLogs(): void {
    try {
      writeFileSync(this.logFile, '')
      writeFileSync(this.metricsFile, '{}')
    } catch (error) {
      console.error('Error clearing logs:', error)
    }
  }
}

export const telemetryService = new TelemetryService()

// Helper function to create a trace ID
export function generateTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}