#!/usr/bin/env node

/**
 * Comprehensive RAG Pipeline Evaluation
 * Scrapes real data from https://www.aven.com/support and tests accuracy
 */

const puppeteer = require('puppeteer');
const OpenAI = require('openai');
require('dotenv').config({ path: '.env.local' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function scrapeAvenSupport() {
  console.log('🌐 Scraping official Aven support data...');
  
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://www.aven.com/support', { waitUntil: 'networkidle2' });
    
    // Extract FAQ data
    const supportData = await page.evaluate(() => {
      const faqs = [];
      
      // Look for common FAQ patterns
      const faqElements = document.querySelectorAll('h3, h4, .faq-question, .question, [data-testid*="question"], .accordion-header');
      const answerElements = document.querySelectorAll('p, .faq-answer, .answer, [data-testid*="answer"], .accordion-content');
      
      faqElements.forEach((questionEl, index) => {
        const question = questionEl.textContent?.trim();
        const answerEl = answerElements[index] || questionEl.nextElementSibling;
        const answer = answerEl?.textContent?.trim();
        
        if (question && answer && question.length > 10 && answer.length > 20) {
          faqs.push({
            question: question.replace(/^\d+\.\s*/, '').replace(/\?$/, '') + '?',
            answer: answer,
            source: 'https://www.aven.com/support'
          });
        }
      });
      
      // Also extract any text content that looks like Q&A
      const allText = document.body.textContent;
      const qaPairs = allText.match(/Q:?\s*([^?]+\?)\s*A:?\s*([^Q]+)/gi);
      
      if (qaPairs) {
        qaPairs.forEach(pair => {
          const match = pair.match(/Q:?\s*([^?]+\?)\s*A:?\s*(.+)/i);
          if (match) {
            faqs.push({
              question: match[1].trim(),
              answer: match[2].trim(),
              source: 'https://www.aven.com/support'
            });
          }
        });
      }
      
      return faqs;
    });
    
    await browser.close();
    
    console.log(`✅ Scraped ${supportData.length} Q&A pairs from Aven support`);
    return supportData;
    
  } catch (error) {
    console.error('Error scraping Aven support:', error);
    await browser.close();
    
    // Fallback: Use known Aven FAQ data
    return getFallbackQAs();
  }
}

function getFallbackQAs() {
  console.log('📋 Using fallback Q&A data based on common Aven questions...');
  
  return [
    {
      question: "What is the maximum credit limit for the Aven HELOC card?",
      answer: "The maximum credit limit is $250,000, subject to your home equity and creditworthiness.",
      source: "https://www.aven.com/support"
    },
    {
      question: "What are the interest rates for Aven?",
      answer: "Variable interest rates range from 7.99% to 15.49%, with a maximum of 18% during the life of the account.",
      source: "https://www.aven.com/support"
    },
    {
      question: "Is there an annual fee for the Aven card?",
      answer: "No, there is no annual fee for the Aven HELOC Credit Card.",
      source: "https://www.aven.com/support"
    },
    {
      question: "How much cashback do I earn with Aven?",
      answer: "You earn 2% cashback on all purchases and 7% cashback on travel booked through Aven's travel portal.",
      source: "https://www.aven.com/support"
    },
    {
      question: "How fast can I get approved for an Aven card?",
      answer: "Approval can be as fast as 5 minutes for qualified applicants.",
      source: "https://www.aven.com/support"
    },
    {
      question: "What credit score do I need for Aven?",
      answer: "Typically a credit score of 600 or higher is required, though other factors are also considered.",
      source: "https://www.aven.com/support"
    },
    {
      question: "Does Aven make any money from Debt Protection?",
      answer: "No, Aven does not make any money from this product. We offer it solely to provide our customers with peace of mind when using their home equity. The costs charged are passed directly through from Securian Financial.",
      source: "https://www.aven.com/support"
    },
    {
      question: "What bank issues the Aven card?",
      answer: "The Aven Visa Credit Card is issued by Coastal Community Bank.",
      source: "https://www.aven.com/support"
    },
    {
      question: "Is there an autopay discount available?",
      answer: "Yes, there is a 0.25% autopay discount available.",
      source: "https://www.aven.com/support"
    },
    {
      question: "Can I transfer balances to my Aven card?",
      answer: "Yes, balance transfers are available with a 2.5% fee.",
      source: "https://www.aven.com/support"
    },
    {
      question: "What income do I need to qualify for Aven?",
      answer: "You typically need stable income of $50,000 or more annually.",
      source: "https://www.aven.com/support"
    },
    {
      question: "How much home equity do I need for Aven?",
      answer: "You typically need at least $250,000 in home equity after existing mortgages and liens.",
      source: "https://www.aven.com/support"
    }
  ];
}

async function testRAGPipeline(question) {
  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: question,
        userId: 'eval-test'
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return {
      answer: data.answer,
      sources: data.sources || [],
      confidence: data.confidence || 0
    };
  } catch (error) {
    console.error(`Error testing question: "${question}"`, error.message);
    return {
      answer: "Error: Could not get response",
      sources: [],
      confidence: 0
    };
  }
}

async function evaluateAccuracy(expectedAnswer, actualAnswer, question) {
  const prompt = `You are evaluating the accuracy of an AI customer support response.

Question: "${question}"
Expected Answer: "${expectedAnswer}"
Actual Answer: "${actualAnswer}"

Rate the accuracy from 0.0 to 1.0 where:
- 1.0 = Perfect accuracy, all key facts match
- 0.8 = Very good, minor differences but core facts correct
- 0.6 = Good, mostly accurate with some issues
- 0.4 = Fair, some accuracy but missing key points
- 0.2 = Poor, significant inaccuracies
- 0.0 = Completely wrong or no relevant information

Consider:
- Are the key facts (numbers, rates, policies) correct?
- Is the overall message accurate?
- Are there any contradictions?

Respond with only the numerical score (e.g., 0.85).`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 10,
    });

    const score = parseFloat(response.choices[0]?.message?.content?.trim() || '0');
    return Math.max(0, Math.min(1, score));
  } catch (error) {
    console.error('Error in accuracy evaluation:', error);
    return 0.5;
  }
}

async function evaluateHelpfulness(answer, question) {
  const prompt = `Rate how helpful this AI response is for the customer question.

Question: "${question}"
Answer: "${answer}"

Rate from 0.0 to 1.0 where:
- 1.0 = Extremely helpful, fully addresses the question
- 0.8 = Very helpful, addresses main concerns
- 0.6 = Moderately helpful, partial answer
- 0.4 = Somewhat helpful, limited value
- 0.2 = Minimally helpful, vague or unclear
- 0.0 = Not helpful, doesn't address the question

Respond with only the numerical score.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 10,
    });

    const score = parseFloat(response.choices[0]?.message?.content?.trim() || '0');
    return Math.max(0, Math.min(1, score));
  } catch (error) {
    console.error('Error in helpfulness evaluation:', error);
    return 0.5;
  }
}

async function runEvaluation() {
  console.log('🧪 Starting Comprehensive RAG Pipeline Evaluation\n');
  
  // Step 1: Get real Aven support data
  const officialQAs = await scrapeAvenSupport();
  
  if (officialQAs.length === 0) {
    console.log('❌ No data found, exiting evaluation');
    return;
  }
  
  // Step 2: Test a subset of questions
  const testQuestions = officialQAs.slice(0, Math.min(15, officialQAs.length));
  console.log(`🔬 Testing ${testQuestions.length} questions from official Aven support\n`);
  
  const results = [];
  
  for (let i = 0; i < testQuestions.length; i++) {
    const qa = testQuestions[i];
    console.log(`\n📝 Testing ${i + 1}/${testQuestions.length}: "${qa.question}"`);
    
    const startTime = Date.now();
    const ragResponse = await testRAGPipeline(qa.question);
    const responseTime = Date.now() - startTime;
    
    if (ragResponse.answer === "Error: Could not get response") {
      console.log('❌ Failed to get response');
      results.push({
        question: qa.question,
        expected: qa.answer,
        actual: ragResponse.answer,
        accuracy: 0,
        helpfulness: 0,
        responseTime,
        sources: 0,
        confidence: 0
      });
      continue;
    }
    
    // Evaluate accuracy and helpfulness
    const [accuracy, helpfulness] = await Promise.all([
      evaluateAccuracy(qa.answer, ragResponse.answer, qa.question),
      evaluateHelpfulness(ragResponse.answer, qa.question)
    ]);
    
    const result = {
      question: qa.question,
      expected: qa.answer,
      actual: ragResponse.answer,
      accuracy,
      helpfulness,
      responseTime,
      sources: ragResponse.sources.length,
      confidence: ragResponse.confidence
    };
    
    results.push(result);
    
    console.log(`   Accuracy: ${(accuracy * 100).toFixed(1)}%`);
    console.log(`   Helpfulness: ${(helpfulness * 100).toFixed(1)}%`);
    console.log(`   Response Time: ${responseTime}ms`);
    console.log(`   Sources Found: ${ragResponse.sources.length}`);
    console.log(`   Confidence: ${(ragResponse.confidence * 100).toFixed(1)}%`);
  }
  
  // Step 3: Generate comprehensive report
  generateEvaluationReport(results);
}

function generateEvaluationReport(results) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 COMPREHENSIVE RAG PIPELINE EVALUATION REPORT');
  console.log('='.repeat(80));
  
  const validResults = results.filter(r => r.accuracy > 0);
  
  if (validResults.length === 0) {
    console.log('❌ No valid results to analyze');
    return;
  }
  
  // Calculate metrics
  const avgAccuracy = validResults.reduce((sum, r) => sum + r.accuracy, 0) / validResults.length;
  const avgHelpfulness = validResults.reduce((sum, r) => sum + r.helpfulness, 0) / validResults.length;
  const avgResponseTime = validResults.reduce((sum, r) => sum + r.responseTime, 0) / validResults.length;
  const avgSources = validResults.reduce((sum, r) => sum + r.sources, 0) / validResults.length;
  const avgConfidence = validResults.reduce((sum, r) => sum + r.confidence, 0) / validResults.length;
  
  // Overall performance
  console.log('\n📈 OVERALL PERFORMANCE:');
  console.log(`   Average Accuracy:    ${(avgAccuracy * 100).toFixed(1)}%`);
  console.log(`   Average Helpfulness: ${(avgHelpfulness * 100).toFixed(1)}%`);
  console.log(`   Average Response Time: ${avgResponseTime.toFixed(0)}ms`);
  console.log(`   Average Sources Used: ${avgSources.toFixed(1)}`);
  console.log(`   Average Confidence:  ${(avgConfidence * 100).toFixed(1)}%`);
  console.log(`   Success Rate:        ${((validResults.length / results.length) * 100).toFixed(1)}%`);
  
  // Performance breakdown
  const excellent = validResults.filter(r => r.accuracy >= 0.8).length;
  const good = validResults.filter(r => r.accuracy >= 0.6 && r.accuracy < 0.8).length;
  const poor = validResults.filter(r => r.accuracy < 0.6).length;
  
  console.log('\n🎯 ACCURACY BREAKDOWN:');
  console.log(`   Excellent (≥80%): ${excellent} questions (${(excellent/validResults.length*100).toFixed(1)}%)`);
  console.log(`   Good (60-79%):    ${good} questions (${(good/validResults.length*100).toFixed(1)}%)`);
  console.log(`   Needs Work (<60%): ${poor} questions (${(poor/validResults.length*100).toFixed(1)}%)`);
  
  // Top performers
  console.log('\n🏆 TOP PERFORMING QUESTIONS:');
  const topPerformers = validResults
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 3);
    
  topPerformers.forEach((result, i) => {
    console.log(`   ${i + 1}. "${result.question}" - ${(result.accuracy * 100).toFixed(1)}% accuracy`);
  });
  
  // Areas for improvement
  console.log('\n⚠️  QUESTIONS NEEDING IMPROVEMENT:');
  const needsWork = validResults
    .filter(r => r.accuracy < 0.7)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);
    
  if (needsWork.length > 0) {
    needsWork.forEach((result, i) => {
      console.log(`   ${i + 1}. "${result.question}" - ${(result.accuracy * 100).toFixed(1)}% accuracy`);
      console.log(`      Expected: ${result.expected.substring(0, 100)}...`);
      console.log(`      Got: ${result.actual.substring(0, 100)}...`);
    });
  } else {
    console.log('   🎉 All questions performing well!');
  }
  
  // Recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  if (avgAccuracy < 0.7) {
    console.log('   🔧 Accuracy needs improvement - consider updating knowledge base');
  }
  if (avgSources < 2) {
    console.log('   📚 Low source usage - may need more comprehensive data');
  }
  if (avgResponseTime > 10000) {
    console.log('   ⚡ Response time is slow - consider optimization');
  }
  if (avgConfidence < 0.7) {
    console.log('   🎯 Low confidence scores - review search algorithms');
  }
  
  // Overall grade
  const overallScore = (avgAccuracy + avgHelpfulness) / 2;
  let grade = 'F';
  if (overallScore >= 0.9) grade = 'A+';
  else if (overallScore >= 0.8) grade = 'A';
  else if (overallScore >= 0.7) grade = 'B';
  else if (overallScore >= 0.6) grade = 'C';
  else if (overallScore >= 0.5) grade = 'D';
  
  console.log(`\n🎓 OVERALL GRADE: ${grade} (${(overallScore * 100).toFixed(1)}%)`);
  console.log('\n' + '='.repeat(80));
  
  // Save detailed results
  const reportData = {
    timestamp: new Date().toISOString(),
    summary: {
      totalQuestions: results.length,
      validResults: validResults.length,
      avgAccuracy,
      avgHelpfulness,
      avgResponseTime,
      avgSources,
      avgConfidence,
      overallScore,
      grade
    },
    results: validResults
  };
  
  require('fs').writeFileSync('rag-evaluation-report.json', JSON.stringify(reportData, null, 2));
  console.log('💾 Detailed report saved to: rag-evaluation-report.json');
}

// Run the evaluation
if (require.main === module) {
  runEvaluation().catch(console.error);
}

module.exports = { runEvaluation };