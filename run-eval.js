#!/usr/bin/env node

/**
 * Aven AI Customer Support Agent - Evaluation Runner
 * 
 * This script provides a command-line interface to run comprehensive evaluations
 * of the AI customer support agent.
 * 
 * Usage:
 *   node run-eval.js [options]
 * 
 * Options:
 *   --full              Run full evaluation with all 50+ questions
 *   --guardrails        Include guardrails testing
 *   --rag               Test RAG pipeline (vector DB + Exa AI)
 *   --rag-health        Quick RAG health check
 *   --accuracy-test     Test RAG accuracy and hallucination detection
 *   --content-verify    Verify vector content and citations
 *   --basic             Run basic evaluation (10 questions)
 *   --metrics           Show current metrics only
 *   --report            Generate detailed report
 *   --export            Export all evaluation data
 */

const https = require('https')
const http = require('http')

const BASE_URL = process.env.EVAL_BASE_URL || 'http://localhost:3000'

async function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL)
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    }

    const client = url.protocol === 'https:' ? https : http
    
    const req = client.request(url, options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          resolve(result)
        } catch (e) {
          resolve({ success: false, error: 'Invalid JSON response' })
        }
      })
    })

    req.on('error', reject)
    
    if (body) {
      req.write(JSON.stringify(body))
    }
    
    req.end()
  })
}

async function runEvaluation(type = 'basic', options = {}) {
  console.log(`🚀 Starting ${type} evaluation...`)
  console.log('⏱️  This may take several minutes...\n')

  const startTime = Date.now()

  try {
    const result = await makeRequest('/api/evaluate', 'POST', {
      type,
      ...options
    })

    const endTime = Date.now()
    const duration = Math.round((endTime - startTime) / 1000)

    if (!result.success) {
      console.error('❌ Evaluation failed:', result.error)
      process.exit(1)
    }

    console.log(`✅ Evaluation completed in ${duration}s\n`)

    // Display results based on type
    switch (type) {
      case 'comprehensive':
        displayComprehensiveResults(result)
        break
      case 'guardrails':
        displayGuardrailsResults(result.guardrails)
        break
      case 'rag':
        displayRAGResults(result.rag)
        break
      case 'rag-health':
        displayRAGHealth(result.health, result.dataFreshness)
        break
      case 'content-verification':
        console.log('📋 CONTENT VERIFICATION REPORT')
        console.log('=' .repeat(50))
        console.log(result.report)
        break
      case 'metrics':
        displayMetrics(result.metrics)
        break
      case 'export':
        console.log('📤 Export data:', JSON.stringify(result.data, null, 2))
        break
      default:
        displayBasicResults(result)
    }

  } catch (error) {
    console.error('❌ Error running evaluation:', error.message)
    process.exit(1)
  }
}

function displayBasicResults(result) {
  console.log('📊 BASIC EVALUATION RESULTS')
  console.log('=' .repeat(50))
  
  if (result.results && result.results.length > 0) {
    const avgAccuracy = result.results.reduce((sum, r) => sum + r.accuracy, 0) / result.results.length
    const avgHelpfulness = result.results.reduce((sum, r) => sum + r.helpfulness, 0) / result.results.length
    const avgCitation = result.results.reduce((sum, r) => sum + r.citationQuality, 0) / result.results.length

    console.log(`Questions Evaluated: ${result.results.length}`)
    console.log(`Average Accuracy: ${(avgAccuracy * 100).toFixed(1)}%`)
    console.log(`Average Helpfulness: ${(avgHelpfulness * 100).toFixed(1)}%`)
    console.log(`Average Citation Quality: ${(avgCitation * 100).toFixed(1)}%`)
  }

  if (result.report) {
    console.log('\n📝 DETAILED REPORT')
    console.log('-'.repeat(30))
    console.log(result.report)
  }
}

function displayComprehensiveResults(result) {
  console.log('🎯 COMPREHENSIVE EVALUATION RESULTS')
  console.log('=' .repeat(50))
  
  if (result.accuracy && result.accuracy.length > 0) {
    const avgAccuracy = result.accuracy.reduce((sum, r) => sum + r.accuracy, 0) / result.accuracy.length
    const avgHelpfulness = result.accuracy.reduce((sum, r) => sum + r.helpfulness, 0) / result.accuracy.length
    
    console.log(`📊 Accuracy Evaluation: ${result.accuracy.length} questions`)
    console.log(`   Average Accuracy: ${(avgAccuracy * 100).toFixed(1)}%`)
    console.log(`   Average Helpfulness: ${(avgHelpfulness * 100).toFixed(1)}%`)
  }

  if (result.guardrails) {
    console.log(`\n🛡️ Guardrails Testing:`)
    console.log(`   Tests Passed: ${result.guardrails.passed}/${result.guardrails.passed + result.guardrails.failed}`)
    console.log(`   Success Rate: ${((result.guardrails.passed / (result.guardrails.passed + result.guardrails.failed)) * 100).toFixed(1)}%`)
  }

  if (result.metrics) {
    console.log(`\n📈 Overall Metrics:`)
    console.log(`   Total Interactions: ${result.metrics.totalInteractions}`)
    console.log(`   Guardrails Block Rate: ${(result.metrics.guardrailsBlockedRate * 100).toFixed(1)}%`)
  }

  if (result.report) {
    console.log('\n📝 COMPREHENSIVE REPORT')
    console.log('-'.repeat(50))
    console.log(result.report)
  }
}

function displayGuardrailsResults(guardrails) {
  console.log('🛡️ GUARDRAILS EVALUATION RESULTS')
  console.log('=' .repeat(50))
  
  console.log(`Tests Passed: ${guardrails.passed}`)
  console.log(`Tests Failed: ${guardrails.failed}`)
  console.log(`Success Rate: ${((guardrails.passed / (guardrails.passed + guardrails.failed)) * 100).toFixed(1)}%`)

  const failed = guardrails.results.filter(r => !r.passed)
  if (failed.length > 0) {
    console.log('\n❌ Failed Tests:')
    failed.forEach(test => {
      console.log(`   ${test.testId}: Expected ${test.expectedBlocked ? 'blocked' : 'allowed'}, got ${test.actualBlocked ? 'blocked' : 'allowed'}`)
    })
  }
}

function displayMetrics(metrics) {
  console.log('📈 CURRENT METRICS')
  console.log('=' .repeat(50))
  
  console.log(`Total Interactions: ${metrics.totalInteractions}`)
  console.log(`Average Accuracy: ${(metrics.averageAccuracy * 100).toFixed(1)}%`)
  console.log(`Average Helpfulness: ${(metrics.averageHelpfulness * 100).toFixed(1)}%`)
  console.log(`Average Citation Quality: ${(metrics.averageCitationQuality * 100).toFixed(1)}%`)
  console.log(`Average Response Time: ${metrics.averageResponseTime.toFixed(0)}ms`)
  console.log(`Guardrails Block Rate: ${(metrics.guardrailsBlockedRate * 100).toFixed(1)}%`)
}

function displayRAGResults(rag) {
  console.log('🔍 RAG PIPELINE EVALUATION RESULTS')
  console.log('=' .repeat(50))
  
  console.log(`Overall RAG Score: ${(rag.overallScore * 100).toFixed(1)}%`)
  
  console.log('\n📊 Vector Database Tests:')
  rag.vectorDbTests.forEach(test => {
    const status = test.passed ? '✅' : '❌'
    console.log(`   ${status} ${test.testName}: ${(test.score * 100).toFixed(1)}%`)
    if (test.error) console.log(`      Error: ${test.error}`)
  })
  
  console.log('\n🌐 Exa AI Data Tests:')
  rag.exaDataTests.forEach(test => {
    const status = test.passed ? '✅' : '❌'
    console.log(`   ${status} ${test.testName}: ${(test.score * 100).toFixed(1)}%`)
    if (test.error) console.log(`      Error: ${test.error}`)
  })
  
  console.log('\n🔄 End-to-End Tests:')
  rag.endToEndTests.forEach(test => {
    const status = test.passed ? '✅' : '❌'
    console.log(`   ${status} ${test.testName}: ${(test.score * 100).toFixed(1)}%`)
    if (test.error) console.log(`      Error: ${test.error}`)
  })
  
  if (rag.recommendations && rag.recommendations.length > 0) {
    console.log('\n💡 Recommendations:')
    rag.recommendations.forEach(rec => console.log(`   ${rec}`))
  }
}

function displayRAGHealth(health, dataFreshness) {
  console.log('🏥 RAG HEALTH CHECK')
  console.log('=' .repeat(50))
  
  const statusIcon = health.status === 'healthy' ? '✅' : 
                    health.status === 'warning' ? '⚠️' : '❌'
  
  console.log(`Status: ${statusIcon} ${health.status.toUpperCase()}`)
  console.log(`Health Score: ${(health.score * 100).toFixed(1)}%`)
  
  if (health.issues && health.issues.length > 0) {
    console.log('\n🚨 Issues Found:')
    health.issues.forEach(issue => console.log(`   • ${issue}`))
  }
  
  console.log('\n📅 Data Freshness:')
  console.log(`   Documents in Vector DB: ${dataFreshness.documentCount}`)
  console.log(`   Needs Refresh: ${dataFreshness.needsRefresh ? '⚠️ Yes' : '✅ No'}`)
  
  if (dataFreshness.needsRefresh) {
    console.log('\n💡 Recommendation: Run the scraper to fetch fresh data from Aven.com')
    console.log('   Command: npm run scrape  (or POST /api/scrape)')
  }
}

// Parse command line arguments
const args = process.argv.slice(2)

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Aven AI Customer Support Agent - Evaluation Runner

Usage: node run-eval.js [options]

Options:
  --full              Run full evaluation with all 50+ questions
  --guardrails        Include guardrails testing  
  --rag               Test RAG pipeline (vector DB + Exa AI)
  --rag-health        Quick RAG health check
  --basic             Run basic evaluation (10 questions) [default]
  --metrics           Show current metrics only
  --report            Generate detailed report
  --export            Export all evaluation data
  --help, -h          Show this help message

Examples:
  node run-eval.js --full --guardrails --rag  # Complete evaluation
  node run-eval.js --content-verify           # Test if RAG uses actual content
  node run-eval.js --accuracy-test            # Test for hallucination
  node run-eval.js --rag                      # Test RAG pipeline only
  node run-eval.js --rag-health               # Quick RAG health check
  node run-eval.js --basic                    # Quick evaluation
  node run-eval.js --metrics                  # View metrics only
`)
  process.exit(0)
}

// Determine evaluation type and options
let type = 'basic'
let options = {}

if (args.includes('--full')) {
  type = 'comprehensive'
  options.fullEvaluation = true
}

if (args.includes('--guardrails')) {
  if (type === 'basic') type = 'guardrails'
  else options.guardrailsTests = true
}

if (args.includes('--rag')) {
  if (type === 'basic') type = 'rag'
  else options.ragTests = true
}

if (args.includes('--rag-health')) {
  type = 'rag-health'
}

if (args.includes('--content-verify')) {
  type = 'content-verification'
}

if (args.includes('--accuracy-test')) {
  console.log('🎯 Running dedicated accuracy test...')
  console.log('This will run the external accuracy test script.')
  const { spawn } = require('child_process')
  const test = spawn('node', ['test-rag-accuracy.js'], { stdio: 'inherit' })
  test.on('close', (code) => {
    process.exit(code)
  })
  return
}

if (args.includes('--metrics')) {
  type = 'metrics'
}

if (args.includes('--export')) {
  type = 'export'
}

if (args.includes('--report')) {
  options.includeReport = true
}

// Run the evaluation
runEvaluation(type, options)