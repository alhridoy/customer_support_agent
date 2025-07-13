import { searchKnowledgeBase } from '@/lib/pinecone'
import { sendChatMessage } from '@/lib/chat'

export interface ContentVerificationResult {
  testName: string
  vectorSearchResults: any[]
  chatResponse: string
  chatSources: any[]
  isUsingRAG: boolean
  isAccurate: boolean
  hasCitations: boolean
  analysis: string
}

// Test if specific Aven facts are in your vector database
export async function verifyVectorContent(): Promise<{
  tests: ContentVerificationResult[]
  summary: {
    totalTests: number
    usingRAG: number
    accurate: number
    cited: number
    score: number
  }
}> {
  const testCases = [
    {
      name: 'Interest Rate Range',
      query: 'Aven interest rate 7.99 15.49',
      chatQuery: 'What are the interest rates for Aven HELOC card?',
      expectedContent: ['7.99', '15.49', 'variable'],
      factCheck: 'Should mention 7.99% - 15.49% rate range'
    },
    {
      name: 'Credit Limit Maximum',
      query: 'Aven credit limit 250000 maximum',
      chatQuery: 'What is the maximum credit limit for Aven card?',
      expectedContent: ['250000', '250,000', '$250'],
      factCheck: 'Should mention $250,000 credit limit'
    },
    {
      name: 'Partner Bank',
      query: 'Aven Coastal Community Bank partner',
      chatQuery: 'Which bank does Aven partner with?',
      expectedContent: ['Coastal Community Bank', 'Coastal Community'],
      factCheck: 'Should mention Coastal Community Bank specifically'
    },
    {
      name: 'Cashback Rate',
      query: 'Aven cashback 2% rewards',
      chatQuery: 'What cashback does Aven offer?',
      expectedContent: ['2%', '2 percent', 'two percent'],
      factCheck: 'Should mention 2% cashback on all purchases'
    },
    {
      name: 'Travel Rewards',
      query: 'Aven travel portal 7% cashback',
      chatQuery: 'What travel rewards does Aven offer?',
      expectedContent: ['7%', 'travel portal', 'seven percent'],
      factCheck: 'Should mention 7% on travel through portal'
    },
    {
      name: 'Annual Fee',
      query: 'Aven annual fee no fee',
      chatQuery: 'Does Aven have an annual fee?',
      expectedContent: ['no annual fee', 'no fee', 'free'],
      factCheck: 'Should mention no annual fee'
    },
    {
      name: 'Approval Time',
      query: 'Aven approval 5 minutes fast',
      chatQuery: 'How fast can I get approved for Aven?',
      expectedContent: ['5 minutes', 'five minutes', 'fast approval'],
      factCheck: 'Should mention approval as fast as 5 minutes'
    },
    {
      name: 'Autopay Discount',
      query: 'Aven autopay discount 0.25%',
      chatQuery: 'What autopay discount does Aven offer?',
      expectedContent: ['0.25%', '0.25 percent', 'quarter percent'],
      factCheck: 'Should mention 0.25% autopay discount'
    },
    {
      name: 'Visa Network',
      query: 'Aven Visa network card',
      chatQuery: 'What payment network does Aven use?',
      expectedContent: ['Visa', 'Visa network'],
      factCheck: 'Should mention Visa network'
    },
    {
      name: 'Home Equity Requirement',
      query: 'Aven home equity requirement 250k',
      chatQuery: 'What home equity do I need for Aven?',
      expectedContent: ['$250', '250k', 'home equity'],
      factCheck: 'Should mention home equity requirements'
    }
  ]

  const results: ContentVerificationResult[] = []

  for (const testCase of testCases) {
    try {
      console.log(`\nTesting: ${testCase.name}`)
      
      // 1. Search vector database directly
      const vectorResults = await searchKnowledgeBase(testCase.query)
      console.log(`Vector search found ${vectorResults.length} results`)

      // 2. Get chat response
      const chatResponse = await sendChatMessage(testCase.chatQuery)
      console.log(`Chat response: ${chatResponse.answer.substring(0, 100)}...`)

      // 3. Analyze if RAG is being used
      const isUsingRAG = analyzeRAGUsage(vectorResults, chatResponse.answer, chatResponse.sources || [])
      
      // 4. Check accuracy
      const isAccurate = checkAccuracy(chatResponse.answer, testCase.expectedContent)
      
      // 5. Check citations
      const hasCitations = (chatResponse.sources?.length || 0) > 0

      // 6. Generate analysis
      const analysis = generateAnalysis(vectorResults, chatResponse, isUsingRAG, isAccurate, hasCitations, testCase.factCheck)

      results.push({
        testName: testCase.name,
        vectorSearchResults: vectorResults.map(r => ({
          title: r.title,
          contentSnippet: r.content.substring(0, 200),
          url: r.url,
          category: r.category
        })),
        chatResponse: chatResponse.answer,
        chatSources: chatResponse.sources || [],
        isUsingRAG,
        isAccurate,
        hasCitations,
        analysis
      })

    } catch (error) {
      results.push({
        testName: testCase.name,
        vectorSearchResults: [],
        chatResponse: '',
        chatSources: [],
        isUsingRAG: false,
        isAccurate: false,
        hasCitations: false,
        analysis: `Error: ${error.message}`
      })
    }
  }

  // Calculate summary
  const summary = {
    totalTests: results.length,
    usingRAG: results.filter(r => r.isUsingRAG).length,
    accurate: results.filter(r => r.isAccurate).length,
    cited: results.filter(r => r.hasCitations).length,
    score: 0
  }

  summary.score = (summary.usingRAG + summary.accurate + summary.cited) / (summary.totalTests * 3)

  return { tests: results, summary }
}

function analyzeRAGUsage(vectorResults: any[], chatAnswer: string, chatSources: any[]): boolean {
  // Check if vector search found relevant content
  if (vectorResults.length === 0) return false

  // Check if chat response has sources (indicating RAG was used)
  if (chatSources.length === 0) return false

  // Check if any vector content appears in the chat response
  const answerLower = chatAnswer.toLowerCase()
  const hasVectorContent = vectorResults.some(result => {
    const contentWords = result.content.toLowerCase().split(/\s+/)
    return contentWords.some(word => word.length > 4 && answerLower.includes(word))
  })

  return hasVectorContent
}

function checkAccuracy(answer: string, expectedContent: string[]): boolean {
  const answerLower = answer.toLowerCase()
  return expectedContent.some(content => answerLower.includes(content.toLowerCase()))
}

function generateAnalysis(
  vectorResults: any[], 
  chatResponse: any, 
  isUsingRAG: boolean, 
  isAccurate: boolean, 
  hasCitations: boolean,
  factCheck: string
): string {
  const issues = []
  const positives = []

  if (vectorResults.length === 0) {
    issues.push('No relevant content found in vector database')
  } else {
    positives.push(`Found ${vectorResults.length} relevant documents`)
  }

  if (!hasCitations) {
    issues.push('No source citations in response')
  } else {
    positives.push(`${chatResponse.sources?.length || 0} sources cited`)
  }

  if (!isUsingRAG) {
    issues.push('RAG pipeline not being used effectively')
  } else {
    positives.push('RAG pipeline is retrieving and using content')
  }

  if (!isAccurate) {
    issues.push(`Response doesn't match expected facts: ${factCheck}`)
  } else {
    positives.push('Response contains accurate information')
  }

  const analysis = []
  if (positives.length > 0) {
    analysis.push(`✅ ${positives.join(', ')}`)
  }
  if (issues.length > 0) {
    analysis.push(`❌ ${issues.join(', ')}`)
  }

  return analysis.join(' | ')
}

// Test for hallucination by asking about non-existent Aven features
export async function testHallucination(): Promise<{
  tests: ContentVerificationResult[]
  hallucinationRate: number
}> {
  const nonExistentQueries = [
    {
      name: 'Cryptocurrency Program',
      query: 'Does Aven offer cryptocurrency investment options?',
      shouldNotExist: true
    },
    {
      name: 'Student Loans',
      query: 'What are Aven\'s student loan rates?',
      shouldNotExist: true
    },
    {
      name: 'Business Checking',
      query: 'Does Aven offer business checking accounts?',
      shouldNotExist: true
    },
    {
      name: 'Mortgage Lending',
      query: 'What are Aven\'s mortgage lending rates?',
      shouldNotExist: true
    },
    {
      name: 'Investment Advisory',
      query: 'Does Aven provide investment advisory services?',
      shouldNotExist: true
    }
  ]

  const results: ContentVerificationResult[] = []

  for (const test of nonExistentQueries) {
    try {
      const response = await sendChatMessage(test.query)
      const isHallucinated = !isProperRefusal(response.answer)

      results.push({
        testName: test.name,
        vectorSearchResults: [],
        chatResponse: response.answer,
        chatSources: response.sources || [],
        isUsingRAG: true, // Not applicable for hallucination tests
        isAccurate: !isHallucinated,
        hasCitations: false, // Should not have citations for non-existent services
        analysis: isHallucinated ? 
          'HALLUCINATED: Made up information about non-existent service' : 
          'CORRECT: Properly indicated Aven doesn\'t offer this service'
      })
    } catch (error) {
      results.push({
        testName: test.name,
        vectorSearchResults: [],
        chatResponse: '',
        chatSources: [],
        isUsingRAG: false,
        isAccurate: false,
        hasCitations: false,
        analysis: `Error: ${error.message}`
      })
    }
  }

  const hallucinationRate = results.filter(r => !r.isAccurate).length / results.length

  return { tests: results, hallucinationRate }
}

function isProperRefusal(answer: string): boolean {
  const refusalPhrases = [
    "don't offer",
    "doesn't offer", 
    "not available",
    "don't provide",
    "doesn't provide",
    "don't have information",
    "can't find information",
    "not sure",
    "don't know",
    "unable to find",
    "no information available"
  ]

  const answerLower = answer.toLowerCase()
  return refusalPhrases.some(phrase => answerLower.includes(phrase))
}

// Export a simple test runner
export async function runContentVerification(): Promise<string> {
  console.log('🔍 Starting Content Verification Tests...')
  
  const verification = await verifyVectorContent()
  const hallucination = await testHallucination()

  const report = `
# RAG Content Verification Report

## Vector Database & RAG Usage Analysis
- **Total Tests**: ${verification.summary.totalTests}
- **Using RAG Pipeline**: ${verification.summary.usingRAG}/${verification.summary.totalTests} (${((verification.summary.usingRAG/verification.summary.totalTests) * 100).toFixed(1)}%)
- **Accurate Responses**: ${verification.summary.accurate}/${verification.summary.totalTests} (${((verification.summary.accurate/verification.summary.totalTests) * 100).toFixed(1)}%)
- **Proper Citations**: ${verification.summary.cited}/${verification.summary.totalTests} (${((verification.summary.cited/verification.summary.totalTests) * 100).toFixed(1)}%)
- **Overall RAG Score**: ${(verification.summary.score * 100).toFixed(1)}%

## Hallucination Detection
- **Tests Run**: ${hallucination.tests.length}
- **Hallucination Rate**: ${(hallucination.hallucinationRate * 100).toFixed(1)}%
- **Proper Refusals**: ${hallucination.tests.filter(t => t.isAccurate).length}/${hallucination.tests.length}

## Detailed Test Results

### Content Verification Tests
${verification.tests.map(test => `
**${test.testName}**
- RAG Usage: ${test.isUsingRAG ? '✅' : '❌'}
- Accuracy: ${test.isAccurate ? '✅' : '❌'}  
- Citations: ${test.hasCitations ? '✅' : '❌'}
- Vector Results: ${test.vectorSearchResults.length} documents found
- Analysis: ${test.analysis}
`).join('')}

### Hallucination Tests
${hallucination.tests.map(test => `
**${test.testName}**
- Status: ${test.isAccurate ? '✅ Proper Refusal' : '🚨 Hallucinated'}
- Analysis: ${test.analysis}
`).join('')}

## Recommendations

${verification.summary.score < 0.7 ? '🚨 **CRITICAL ISSUES**\n- Your RAG pipeline has significant problems\n- Vector database may not contain proper Aven content\n- Run data scraping and re-index immediately' : ''}

${verification.summary.usingRAG < verification.summary.totalTests * 0.8 ? '⚠️ **RAG NOT BEING USED**\n- Responses may be coming from LLM training data\n- Check if vector search is returning relevant results\n- Verify prompt engineering emphasizes using retrieved context' : ''}

${hallucination.hallucinationRate > 0.2 ? '🚨 **HIGH HALLUCINATION RATE**\n- AI is making up information about non-existent services\n- Implement stronger guardrails for unknown information\n- Improve prompt to only answer based on retrieved context' : ''}

${verification.summary.cited < verification.summary.totalTests * 0.8 ? '📚 **POOR CITATION QUALITY**\n- Responses lack proper source attribution\n- Users can\'t verify information\n- Improve citation formatting in prompts' : ''}

${verification.summary.score >= 0.8 && hallucination.hallucinationRate <= 0.2 ? '✅ **EXCELLENT PERFORMANCE**\n- RAG pipeline is working correctly\n- Low hallucination rate\n- Good source attribution\n- Ready for production deployment' : ''}
`

  return report
}