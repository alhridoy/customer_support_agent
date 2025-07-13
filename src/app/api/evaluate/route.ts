import { NextRequest, NextResponse } from 'next/server'
import { 
  runEvaluation, 
  generateEvaluationReport, 
  runComprehensiveEvaluation,
  runGuardrailsEvaluation,
  exportEvaluationData,
  evaluationQuestions
} from '@/utils/evaluation'
import { 
  runRAGEvaluation, 
  ragHealthCheck, 
  checkDataFreshness 
} from '@/utils/rag-evaluation'
import { telemetryService } from '@/utils/telemetry'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      type = 'basic', 
      questionCount = 10,
      fullEvaluation = false,
      guardrailsTests = false,
      ragTests = false,
      includeReport = true 
    } = body

    switch (type) {
      case 'comprehensive':
        const comprehensiveResults = await runComprehensiveEvaluation({
          fullEvaluation,
          guardrailsTests,
          ragTests,
          includeReport
        })
        return NextResponse.json({
          success: true,
          ...comprehensiveResults
        })

      case 'guardrails':
        const guardrailsResults = await runGuardrailsEvaluation()
        return NextResponse.json({
          success: true,
          guardrails: guardrailsResults
        })

      case 'rag':
        const ragResults = await runRAGEvaluation()
        return NextResponse.json({
          success: true,
          rag: ragResults
        })

      case 'rag-health':
        const healthCheck = await ragHealthCheck()
        const dataFreshness = await checkDataFreshness()
        return NextResponse.json({
          success: true,
          health: healthCheck,
          dataFreshness
        })

      case 'content-verification':
        const { runContentVerification } = await import('@/utils/content-verification')
        const verificationReport = await runContentVerification()
        return NextResponse.json({
          success: true,
          report: verificationReport
        })

      case 'export':
        const exportData = exportEvaluationData()
        return NextResponse.json({
          success: true,
          data: exportData
        })

      case 'metrics':
        const metrics = telemetryService.calculateMetrics()
        const report = telemetryService.generateDetailedReport()
        return NextResponse.json({
          success: true,
          metrics,
          report
        })

      default: // basic evaluation
        const questions = evaluationQuestions.slice(0, questionCount)
        const results = await runEvaluation(questions)
        const basicReport = generateEvaluationReport(results)
        
        return NextResponse.json({
          success: true,
          results,
          report: basicReport,
        })
    }
  } catch (error) {
    console.error('Evaluation error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to run evaluation' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'metrics'

    switch (type) {
      case 'metrics':
        const metrics = telemetryService.calculateMetrics()
        return NextResponse.json({ success: true, metrics })

      case 'traces':
        const limit = parseInt(searchParams.get('limit') || '50')
        const traces = telemetryService.getTraces(limit)
        return NextResponse.json({ success: true, traces })

      case 'report':
        const report = telemetryService.generateDetailedReport()
        return NextResponse.json({ success: true, report })

      case 'questions':
        return NextResponse.json({ 
          success: true, 
          questions: evaluationQuestions,
          count: evaluationQuestions.length 
        })

      case 'rag-health':
        const healthResult = await ragHealthCheck()
        const freshnessResult = await checkDataFreshness()
        return NextResponse.json({ 
          success: true, 
          health: healthResult,
          dataFreshness: freshnessResult 
        })

      default:
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid type parameter' 
        }, { status: 400 })
    }
  } catch (error) {
    console.error('Evaluation GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch evaluation data' },
      { status: 500 }
    )
  }
}
