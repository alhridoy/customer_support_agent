import { searchKnowledgeBase, addToKnowledgeBase } from '@/lib/pinecone'
import { scrapeAvenData } from '@/lib/scraper'
import { generateEmbedding } from '@/lib/openai'
import { AvenKnowledgeItem } from '@/types'
import { Exa } from 'exa-js'

// RAG Pipeline Evaluation Tests
export interface RAGTestResult {
  testName: string
  passed: boolean
  score: number
  details: any
  error?: string
}

export interface RAGEvaluationReport {
  vectorDbTests: RAGTestResult[]
  exaDataTests: RAGTestResult[]
  endToEndTests: RAGTestResult[]
  overallScore: number
  recommendations: string[]
}

// Vector Database Tests
export async function testVectorDatabase(): Promise<RAGTestResult[]> {
  const tests: RAGTestResult[] = []

  // Test 1: Basic Vector Search
  try {
    const testQuery = "What is the interest rate for Aven HELOC card?"
    const results = await searchKnowledgeBase(testQuery)
    
    tests.push({
      testName: "Vector Search Functionality",
      passed: results.length > 0,
      score: results.length > 0 ? 1 : 0,
      details: {
        queryTested: testQuery,
        resultsCount: results.length,
        topResult: results[0]?.title || 'No results'
      }
    })
  } catch (error) {
    tests.push({
      testName: "Vector Search Functionality",
      passed: false,
      score: 0,
      details: {},
      error: error.message
    })
  }

  // Test 2: Embedding Generation
  try {
    const testText = "Aven HELOC credit card features"
    const embedding = await generateEmbedding(testText)
    
    tests.push({
      testName: "Embedding Generation",
      passed: embedding && embedding.length > 0,
      score: embedding && embedding.length > 0 ? 1 : 0,
      details: {
        embeddingDimensions: embedding?.length || 0,
        textTested: testText
      }
    })
  } catch (error) {
    tests.push({
      testName: "Embedding Generation",
      passed: false,
      score: 0,
      details: {},
      error: error.message
    })
  }

  // Test 3: Semantic Search Quality
  try {
    const semanticQueries = [
      { query: "credit limit maximum", expectedKeyword: "250000" },
      { query: "cashback rewards percentage", expectedKeyword: "2%" },
      { query: "annual fee cost", expectedKeyword: "no annual fee" },
      { query: "approval time", expectedKeyword: "5 minutes" }
    ]

    let semanticPassed = 0
    const semanticDetails = []

    for (const test of semanticQueries) {
      const results = await searchKnowledgeBase(test.query)
      const hasRelevantResult = results.some(r => 
        r.content.toLowerCase().includes(test.expectedKeyword.toLowerCase()) ||
        r.title.toLowerCase().includes(test.expectedKeyword.toLowerCase())
      )
      
      if (hasRelevantResult) semanticPassed++
      
      semanticDetails.push({
        query: test.query,
        expectedKeyword: test.expectedKeyword,
        found: hasRelevantResult,
        topResultTitle: results[0]?.title || 'No results'
      })
    }

    tests.push({
      testName: "Semantic Search Quality",
      passed: semanticPassed >= semanticQueries.length * 0.75, // 75% pass rate
      score: semanticPassed / semanticQueries.length,
      details: {
        totalTests: semanticQueries.length,
        passed: semanticPassed,
        results: semanticDetails
      }
    })
  } catch (error) {
    tests.push({
      testName: "Semantic Search Quality",
      passed: false,
      score: 0,
      details: {},
      error: error.message
    })
  }

  // Test 4: Data Freshness (check if we have recent data)
  try {
    const allResults = await searchKnowledgeBase("Aven")
    const hasManualData = allResults.some(r => r.id.startsWith('aven-heloc-overview'))
    const hasScrapedData = allResults.some(r => r.url && r.url.includes('aven.com') && !r.id.startsWith('aven-heloc-overview'))

    tests.push({
      testName: "Data Freshness & Coverage",
      passed: hasManualData && hasScrapedData,
      score: (hasManualData ? 0.5 : 0) + (hasScrapedData ? 0.5 : 0),
      details: {
        totalDocuments: allResults.length,
        hasManualData,
        hasScrapedData,
        documentTypes: allResults.map(r => ({ id: r.id, category: r.category, url: r.url }))
      }
    })
  } catch (error) {
    tests.push({
      testName: "Data Freshness & Coverage",
      passed: false,
      score: 0,
      details: {},
      error: error.message
    })
  }

  return tests
}

// Exa AI Data Quality Tests
export async function testExaDataFetching(): Promise<RAGTestResult[]> {
  const tests: RAGTestResult[] = []

  // Test 1: Exa API Connection
  try {
    const exa = new Exa(process.env.EXA_API_KEY || '')
    const testSearch = await exa.search("Aven HELOC", {
      numResults: 1,
      includeDomains: ['aven.com']
    })

    tests.push({
      testName: "Exa API Connection",
      passed: testSearch.results && testSearch.results.length > 0,
      score: testSearch.results && testSearch.results.length > 0 ? 1 : 0,
      details: {
        resultsFound: testSearch.results?.length || 0,
        firstResult: testSearch.results?.[0]?.url || 'No results'
      }
    })
  } catch (error) {
    tests.push({
      testName: "Exa API Connection",
      passed: false,
      score: 0,
      details: {},
      error: error.message
    })
  }

  // Test 2: Aven.com Domain Coverage
  try {
    const exa = new Exa(process.env.EXA_API_KEY || '')
    const avenQueries = [
      "Aven HELOC credit card",
      "Aven application process", 
      "Aven interest rates",
      "Aven customer support",
      "Aven eligibility requirements"
    ]

    let domainCoverage = 0
    const coverageDetails = []

    for (const query of avenQueries) {
      const searchResult = await exa.search(query, {
        numResults: 3,
        includeDomains: ['aven.com']
      })

      const avenResults = searchResult.results?.filter(r => r.url.includes('aven.com')) || []
      if (avenResults.length > 0) domainCoverage++

      coverageDetails.push({
        query,
        avenResultsCount: avenResults.length,
        urls: avenResults.map(r => r.url)
      })
    }

    tests.push({
      testName: "Aven.com Domain Coverage",
      passed: domainCoverage >= avenQueries.length * 0.8, // 80% coverage
      score: domainCoverage / avenQueries.length,
      details: {
        totalQueries: avenQueries.length,
        successfulQueries: domainCoverage,
        coverage: coverageDetails
      }
    })
  } catch (error) {
    tests.push({
      testName: "Aven.com Domain Coverage",
      passed: false,
      score: 0,
      details: {},
      error: error.message
    })
  }

  // Test 3: Content Quality & Accuracy
  try {
    const exa = new Exa(process.env.EXA_API_KEY || '')
    const searchResult = await exa.search("Aven HELOC credit card features", {
      numResults: 2,
      includeDomains: ['aven.com']
    })

    if (searchResult.results && searchResult.results.length > 0) {
      const contentResult = await exa.getContents([searchResult.results[0].id])
      const content = contentResult.results?.[0]?.text || ''

      // Check for key Aven facts in the content
      const keyFacts = [
        '250000', '250,000', // Credit limit
        '7.99', '15.49', // Interest rates
        '2%', 'cashback', // Rewards
        'no annual fee', 'annual fee', // Fees
        'heloc', 'home equity', // Product type
        'visa' // Network
      ]

      const factsFound = keyFacts.filter(fact => 
        content.toLowerCase().includes(fact.toLowerCase())
      ).length

      tests.push({
        testName: "Content Quality & Accuracy",
        passed: factsFound >= keyFacts.length * 0.5, // 50% of key facts
        score: factsFound / keyFacts.length,
        details: {
          contentLength: content.length,
          keyFactsFound: factsFound,
          totalKeyFacts: keyFacts.length,
          url: searchResult.results[0].url,
          title: searchResult.results[0].title
        }
      })
    } else {
      tests.push({
        testName: "Content Quality & Accuracy",
        passed: false,
        score: 0,
        details: { error: "No search results found" }
      })
    }
  } catch (error) {
    tests.push({
      testName: "Content Quality & Accuracy",
      passed: false,
      score: 0,
      details: {},
      error: error.message
    })
  }

  return tests
}

// End-to-End RAG Pipeline Tests
export async function testEndToEndRAG(): Promise<RAGTestResult[]> {
  const tests: RAGTestResult[] = []

  // Test 1: Complete RAG Pipeline
  try {
    const testQuestions = [
      "What is the maximum credit limit for Aven HELOC card?",
      "What are the interest rates for Aven?", 
      "Does Aven have an annual fee?",
      "How quickly can I get approved?",
      "What cashback rewards does Aven offer?"
    ]

    let pipelineSuccesses = 0
    const pipelineDetails = []

    for (const question of testQuestions) {
      try {
        const results = await searchKnowledgeBase(question)
        const hasRelevantResult = results.length > 0 && results[0].content.length > 50
        
        if (hasRelevantResult) pipelineSuccesses++
        
        pipelineDetails.push({
          question,
          resultsCount: results.length,
          hasRelevantResult,
          topResultTitle: results[0]?.title || 'No results',
          topResultLength: results[0]?.content?.length || 0
        })
      } catch (error) {
        pipelineDetails.push({
          question,
          error: error.message
        })
      }
    }

    tests.push({
      testName: "Complete RAG Pipeline",
      passed: pipelineSuccesses >= testQuestions.length * 0.8, // 80% success rate
      score: pipelineSuccesses / testQuestions.length,
      details: {
        totalQuestions: testQuestions.length,
        successful: pipelineSuccesses,
        results: pipelineDetails
      }
    })
  } catch (error) {
    tests.push({
      testName: "Complete RAG Pipeline",
      passed: false,
      score: 0,
      details: {},
      error: error.message
    })
  }

  return tests
}

// Main RAG evaluation function
export async function runRAGEvaluation(): Promise<RAGEvaluationReport> {
  console.log('🔍 Starting RAG Pipeline Evaluation...')

  const vectorDbTests = await testVectorDatabase()
  const exaDataTests = await testExaDataFetching()
  const endToEndTests = await testEndToEndRAG()

  const allTests = [...vectorDbTests, ...exaDataTests, ...endToEndTests]
  const overallScore = allTests.reduce((sum, test) => sum + test.score, 0) / allTests.length

  const recommendations = generateRAGRecommendations(vectorDbTests, exaDataTests, endToEndTests)

  return {
    vectorDbTests,
    exaDataTests,
    endToEndTests,
    overallScore,
    recommendations
  }
}

function generateRAGRecommendations(
  vectorDbTests: RAGTestResult[],
  exaDataTests: RAGTestResult[],
  endToEndTests: RAGTestResult[]
): string[] {
  const recommendations = []

  // Vector DB issues
  const vectorSearchTest = vectorDbTests.find(t => t.testName === "Vector Search Functionality")
  if (!vectorSearchTest?.passed) {
    recommendations.push("🔧 Vector search is failing - check Pinecone configuration and API keys")
  }

  const embeddingTest = vectorDbTests.find(t => t.testName === "Embedding Generation")
  if (!embeddingTest?.passed) {
    recommendations.push("🔧 Embedding generation failing - verify OpenAI API key and model access")
  }

  const semanticTest = vectorDbTests.find(t => t.testName === "Semantic Search Quality")
  if (semanticTest && semanticTest.score < 0.7) {
    recommendations.push("📊 Semantic search quality low - consider re-indexing data or improving embeddings")
  }

  // Exa AI issues
  const exaConnectionTest = exaDataTests.find(t => t.testName === "Exa API Connection")
  if (!exaConnectionTest?.passed) {
    recommendations.push("🔧 Exa AI connection failing - check API key and network connectivity")
  }

  const domainCoverageTest = exaDataTests.find(t => t.testName === "Aven.com Domain Coverage")
  if (domainCoverageTest && domainCoverageTest.score < 0.8) {
    recommendations.push("📈 Low Aven.com coverage - run scraper to fetch more recent data")
  }

  const contentQualityTest = exaDataTests.find(t => t.testName === "Content Quality & Accuracy")
  if (contentQualityTest && contentQualityTest.score < 0.5) {
    recommendations.push("📝 Content quality issues - verify Exa is fetching correct Aven pages")
  }

  // End-to-end issues
  const e2eTest = endToEndTests.find(t => t.testName === "Complete RAG Pipeline")
  if (e2eTest && e2eTest.score < 0.8) {
    recommendations.push("🔄 End-to-end pipeline issues - check data flow from Exa → Pinecone → Search")
  }

  if (recommendations.length === 0) {
    recommendations.push("✅ RAG pipeline is working well! Consider running scraper periodically for fresh data")
  }

  return recommendations
}

// Utility function to run data freshness check
export async function checkDataFreshness(): Promise<{
  lastScrapedData: Date | null
  documentCount: number
  needsRefresh: boolean
}> {
  try {
    const allDocs = await searchKnowledgeBase("Aven")
    const hasRecentData = allDocs.some(doc => 
      doc.id.includes(Date.now().toString().substring(0, 8)) // Today's data
    )

    return {
      lastScrapedData: hasRecentData ? new Date() : null,
      documentCount: allDocs.length,
      needsRefresh: !hasRecentData || allDocs.length < 10
    }
  } catch (error) {
    return {
      lastScrapedData: null,
      documentCount: 0,
      needsRefresh: true
    }
  }
}

// Quick RAG health check
export async function ragHealthCheck(): Promise<{
  status: 'healthy' | 'warning' | 'critical'
  issues: string[]
  score: number
}> {
  try {
    // Quick tests
    const vectorResults = await searchKnowledgeBase("Aven HELOC")
    const hasResults = vectorResults.length > 0
    const hasContent = vectorResults.some(r => r.content.length > 100)
    
    const score = (hasResults ? 0.5 : 0) + (hasContent ? 0.5 : 0)
    const issues = []
    
    if (!hasResults) issues.push("No search results found")
    if (!hasContent) issues.push("Search results lack content")
    
    const status = score >= 0.8 ? 'healthy' : score >= 0.5 ? 'warning' : 'critical'
    
    return { status, issues, score }
  } catch (error) {
    return {
      status: 'critical',
      issues: [`RAG pipeline error: ${error.message}`],
      score: 0
    }
  }
}