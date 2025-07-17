#!/usr/bin/env node

/**
 * Evaluate Agent Against 52 Realistic Questions
 * Scores for accuracy, helpfulness, and citation quality
 */

const fs = require('fs');
const OpenAI = require('openai');
require('dotenv').config({ path: '.env.local' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Load the 52-question evaluation dataset
function loadEvaluationDataset() {
  try {
    const data = fs.readFileSync('./evaluation-dataset.json', 'utf8');
    const dataset = JSON.parse(data);
    return dataset.questions;
  } catch (error) {
    console.error('❌ Error loading evaluation dataset:', error);
    process.exit(1);
  }
}

// Query your RAG agent
async function queryAgent(question) {
  try {
    const response = await fetch('http://localhost:3004/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: question,
        userId: 'eval-agent-52q'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      answer: data.answer || '',
      sources: data.sources || [],
      confidence: data.confidence || 0
    };
  } catch (error) {
    console.error(`❌ Error querying agent: ${error.message}`);
    return {
      answer: '',
      sources: [],
      confidence: 0
    };
  }
}

// Evaluate accuracy using LLM
async function evaluateAccuracy(expectedAnswer, actualAnswer, question) {
  const prompt = `You are evaluating the accuracy of an AI customer support response for Aven HELOC Credit Card.

Question: "${question}"
Expected Answer: "${expectedAnswer}"
Actual Answer: "${actualAnswer}"

Rate the accuracy from 0.0 to 1.0 where:
- 1.0 = Perfect accuracy, all key facts match exactly
- 0.8 = Very good, minor differences but core facts correct
- 0.6 = Good, mostly accurate with some missing details
- 0.4 = Fair, some accuracy but missing key information
- 0.2 = Poor, significant inaccuracies or wrong information
- 0.0 = Completely wrong or no relevant information

Return only a decimal number between 0.0 and 1.0.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 10
    });

    const score = parseFloat(response.choices[0].message.content.trim());
    return Math.max(0, Math.min(1, score));
  } catch (error) {
    console.error('Error in accuracy evaluation:', error);
    return 0.5;
  }
}

// Evaluate helpfulness using LLM
async function evaluateHelpfulness(answer, question) {
  const prompt = `Rate how helpful this AI response is for a customer asking about Aven HELOC Credit Card.

Question: "${question}"
Answer: "${answer}"

Rate the helpfulness from 0.0 to 1.0 where:
- 1.0 = Extremely helpful, complete and actionable information
- 0.8 = Very helpful, mostly complete with good guidance
- 0.6 = Moderately helpful, provides useful information
- 0.4 = Somewhat helpful, basic information but lacks detail
- 0.2 = Minimally helpful, vague or incomplete
- 0.0 = Not helpful, confusing or irrelevant

Return only a decimal number between 0.0 and 1.0.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 10
    });

    const score = parseFloat(response.choices[0].message.content.trim());
    return Math.max(0, Math.min(1, score));
  } catch (error) {
    console.error('Error in helpfulness evaluation:', error);
    return 0.5;
  }
}

// Evaluate citation quality
async function evaluateCitationQuality(answer, sources, question) {
  const prompt = `Rate the citation quality for this AI customer support response.

Question: "${question}"
Answer: "${answer}"
Sources Provided: ${sources.length > 0 ? sources.map(s => s.title || s.url || s.content?.substring(0, 50)).join(', ') : 'No sources'}

Rate the citation quality from 0.0 to 1.0 where:
- 1.0 = Perfect citations, all claims backed by relevant sources
- 0.8 = Very good citations, most claims properly sourced
- 0.6 = Good citations, adequate source backing
- 0.4 = Fair citations, some sources but could be better
- 0.2 = Poor citations, minimal or irrelevant sources
- 0.0 = No citations or completely irrelevant sources

Return only a decimal number between 0.0 and 1.0.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 10
    });

    const score = parseFloat(response.choices[0].message.content.trim());
    return Math.max(0, Math.min(1, score));
  } catch (error) {
    console.error('Error in citation quality evaluation:', error);
    return 0.5;
  }
}

// Main evaluation function
async function runEvaluation() {
  console.log('🚀 Starting 52-Question Agent Evaluation');
  console.log('=' .repeat(60));

  const questions = loadEvaluationDataset();
  console.log(`📝 Loaded ${questions.length} evaluation questions`);

  const results = [];
  let totalQuestions = 0;
  let successfulEvaluations = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    totalQuestions++;
    
    console.log(`\\n[${i + 1}/${questions.length}] Category: ${q.category} | Complexity: ${q.complexity}`);
    console.log(`Question: ${q.question}`);

    const startTime = Date.now();
    
    try {
      // Query the agent
      const agentResponse = await queryAgent(q.question);
      const responseTime = Date.now() - startTime;

      if (!agentResponse.answer) {
        console.log('❌ No response from agent');
        results.push({
          id: q.id,
          question: q.question,
          category: q.category,
          complexity: q.complexity,
          expected: q.ground_truth,
          actual: '',
          accuracy: 0,
          helpfulness: 0,
          citationQuality: 0,
          responseTime,
          sources: 0,
          error: 'No response'
        });
        continue;
      }

      console.log(`Agent Response: ${agentResponse.answer.substring(0, 100)}...`);
      console.log(`Sources: ${agentResponse.sources.length}`);

      // Evaluate all three metrics
      console.log('🔄 Evaluating accuracy, helpfulness, and citation quality...');
      
      const [accuracy, helpfulness, citationQuality] = await Promise.all([
        evaluateAccuracy(q.ground_truth, agentResponse.answer, q.question),
        evaluateHelpfulness(agentResponse.answer, q.question),
        evaluateCitationQuality(agentResponse.answer, agentResponse.sources, q.question)
      ]);

      const result = {
        id: q.id,
        question: q.question,
        category: q.category,
        complexity: q.complexity,
        expected: q.ground_truth,
        actual: agentResponse.answer,
        accuracy,
        helpfulness,
        citationQuality,
        responseTime,
        sources: agentResponse.sources.length,
        confidence: agentResponse.confidence
      };

      results.push(result);
      successfulEvaluations++;

      console.log(`✅ Accuracy: ${(accuracy * 100).toFixed(1)}% | Helpfulness: ${(helpfulness * 100).toFixed(1)}% | Citations: ${(citationQuality * 100).toFixed(1)}%`);
      console.log(`⏱️  Response Time: ${responseTime}ms | Sources: ${agentResponse.sources.length}`);

    } catch (error) {
      console.error(`❌ Error evaluating question ${q.id}:`, error);
      results.push({
        id: q.id,
        question: q.question,
        category: q.category,
        complexity: q.complexity,
        expected: q.ground_truth,
        actual: '',
        accuracy: 0,
        helpfulness: 0,
        citationQuality: 0,
        responseTime: Date.now() - startTime,
        sources: 0,
        error: error.message
      });
    }

    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Generate comprehensive report
  generateReport(results, totalQuestions, successfulEvaluations);
  
  // Save detailed results
  fs.writeFileSync('./52-questions-evaluation-results.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    totalQuestions,
    successfulEvaluations,
    results
  }, null, 2));

  console.log('\\n💾 Detailed results saved to: 52-questions-evaluation-results.json');
}

function generateReport(results, totalQuestions, successfulEvaluations) {
  console.log('\\n' + '='.repeat(80));
  console.log('📊 52-QUESTION AGENT EVALUATION REPORT');
  console.log('='.repeat(80));

  const validResults = results.filter(r => r.accuracy > 0 || r.helpfulness > 0 || r.citationQuality > 0);
  
  if (validResults.length === 0) {
    console.log('❌ No valid results - all evaluations failed');
    return;
  }

  // Overall metrics
  const avgAccuracy = validResults.reduce((sum, r) => sum + r.accuracy, 0) / validResults.length;
  const avgHelpfulness = validResults.reduce((sum, r) => sum + r.helpfulness, 0) / validResults.length;
  const avgCitationQuality = validResults.reduce((sum, r) => sum + r.citationQuality, 0) / validResults.length;
  const avgResponseTime = validResults.reduce((sum, r) => sum + r.responseTime, 0) / validResults.length;
  const avgSources = validResults.reduce((sum, r) => sum + r.sources, 0) / validResults.length;

  // Overall score (equal weight to all three metrics)
  const overallScore = (avgAccuracy + avgHelpfulness + avgCitationQuality) / 3;

  console.log('\\n🎯 OVERALL PERFORMANCE:');
  console.log(`   Questions Evaluated: ${successfulEvaluations}/${totalQuestions} (${(successfulEvaluations/totalQuestions*100).toFixed(1)}%)`);
  console.log(`   Overall Score: ${(overallScore * 100).toFixed(1)}% (${getGrade(overallScore)})`);
  console.log(`   Accuracy: ${(avgAccuracy * 100).toFixed(1)}%`);
  console.log(`   Helpfulness: ${(avgHelpfulness * 100).toFixed(1)}%`);
  console.log(`   Citation Quality: ${(avgCitationQuality * 100).toFixed(1)}%`);
  console.log(`   Avg Response Time: ${avgResponseTime.toFixed(0)}ms`);
  console.log(`   Avg Sources Used: ${avgSources.toFixed(1)}`);

  // Performance by category
  console.log('\\n📈 PERFORMANCE BY CATEGORY:');
  const categories = [...new Set(validResults.map(r => r.category))];
  
  categories.forEach(category => {
    const categoryResults = validResults.filter(r => r.category === category);
    const catAccuracy = categoryResults.reduce((sum, r) => sum + r.accuracy, 0) / categoryResults.length;
    const catHelpfulness = categoryResults.reduce((sum, r) => sum + r.helpfulness, 0) / categoryResults.length;
    const catCitations = categoryResults.reduce((sum, r) => sum + r.citationQuality, 0) / categoryResults.length;
    const catOverall = (catAccuracy + catHelpfulness + catCitations) / 3;
    
    console.log(`   ${category} (${categoryResults.length}): ${(catOverall * 100).toFixed(1)}% overall`);
    console.log(`      Accuracy: ${(catAccuracy * 100).toFixed(1)}% | Helpfulness: ${(catHelpfulness * 100).toFixed(1)}% | Citations: ${(catCitations * 100).toFixed(1)}%`);
  });

  // Performance by complexity
  console.log('\\n🎲 PERFORMANCE BY COMPLEXITY:');
  const complexities = ['basic', 'intermediate', 'advanced'];
  
  complexities.forEach(complexity => {
    const complexityResults = validResults.filter(r => r.complexity === complexity);
    if (complexityResults.length > 0) {
      const compAccuracy = complexityResults.reduce((sum, r) => sum + r.accuracy, 0) / complexityResults.length;
      const compHelpfulness = complexityResults.reduce((sum, r) => sum + r.helpfulness, 0) / complexityResults.length;
      const compCitations = complexityResults.reduce((sum, r) => sum + r.citationQuality, 0) / complexityResults.length;
      const compOverall = (compAccuracy + compHelpfulness + compCitations) / 3;
      
      console.log(`   ${complexity} (${complexityResults.length}): ${(compOverall * 100).toFixed(1)}% overall`);
      console.log(`      Accuracy: ${(compAccuracy * 100).toFixed(1)}% | Helpfulness: ${(compHelpfulness * 100).toFixed(1)}% | Citations: ${(compCitations * 100).toFixed(1)}%`);
    }
  });

  // Top performers
  console.log('\\n🏆 TOP PERFORMING QUESTIONS:');
  const topPerformers = validResults
    .map(r => ({...r, overall: (r.accuracy + r.helpfulness + r.citationQuality) / 3}))
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 5);
    
  topPerformers.forEach((result, i) => {
    console.log(`   ${i + 1}. "${result.question.substring(0, 60)}..." - ${(result.overall * 100).toFixed(1)}%`);
    console.log(`      Accuracy: ${(result.accuracy * 100).toFixed(1)}% | Helpfulness: ${(result.helpfulness * 100).toFixed(1)}% | Citations: ${(result.citationQuality * 100).toFixed(1)}%`);
  });

  // Areas needing improvement
  console.log('\\n⚠️  QUESTIONS NEEDING IMPROVEMENT:');
  const needsWork = validResults
    .map(r => ({...r, overall: (r.accuracy + r.helpfulness + r.citationQuality) / 3}))
    .filter(r => r.overall < 0.6)
    .sort((a, b) => a.overall - b.overall)
    .slice(0, 5);
    
  if (needsWork.length > 0) {
    needsWork.forEach((result, i) => {
      console.log(`   ${i + 1}. "${result.question.substring(0, 60)}..." - ${(result.overall * 100).toFixed(1)}%`);
      console.log(`      Accuracy: ${(result.accuracy * 100).toFixed(1)}% | Helpfulness: ${(result.helpfulness * 100).toFixed(1)}% | Citations: ${(result.citationQuality * 100).toFixed(1)}%`);
    });
  } else {
    console.log('   🎉 No questions scored below 60% - excellent performance!');
  }

  // Recommendations
  console.log('\\n💡 RECOMMENDATIONS:');
  if (avgAccuracy < 0.7) {
    console.log('   🔧 Accuracy needs improvement - review knowledge base and fact-checking');
  }
  if (avgHelpfulness < 0.7) {
    console.log('   🔧 Helpfulness needs improvement - provide more actionable guidance');
  }
  if (avgCitationQuality < 0.7) {
    console.log('   🔧 Citation quality needs improvement - ensure sources support claims');
  }
  if (avgResponseTime > 8000) {
    console.log('   ⚡ Response time could be faster - optimize RAG pipeline');
  }
  if (avgSources < 2) {
    console.log('   📚 Consider retrieving more sources for better context');
  }

  console.log('\\n' + '='.repeat(80));
}

function getGrade(score) {
  if (score >= 0.9) return 'A+';
  if (score >= 0.8) return 'A';
  if (score >= 0.7) return 'B';
  if (score >= 0.6) return 'C';
  if (score >= 0.5) return 'D';
  return 'F';
}

// Run the evaluation
if (require.main === module) {
  runEvaluation().catch(console.error);
}

module.exports = { runEvaluation, loadEvaluationDataset };