#!/usr/bin/env python3

"""
RAGAS Evaluation for Aven AI Customer Agent
Implements industry-standard RAG evaluation metrics
"""

import os
import sys
import json
import asyncio
import requests
from typing import List, Dict, Any
from datasets import Dataset
from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall,
    answer_similarity,
    answer_correctness
)
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
import pandas as pd
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path='.env.local')

class RAGASEvaluator:
    def __init__(self):
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY not found in environment variables")
        
        # Initialize RAGAS with OpenAI models
        self.llm = ChatOpenAI(
            model="gpt-4.1-mini",
            temperature=0,
            api_key=self.openai_api_key
        )
        
        self.embeddings = OpenAIEmbeddings(
            model="text-embedding-3-small",
            api_key=self.openai_api_key
        )
        
        # Configure RAGAS metrics
        self.metrics = [
            faithfulness,
            answer_relevancy,
            context_precision,
            context_recall,
            answer_similarity,
            answer_correctness
        ]
        
        print("🎯 RAGAS Evaluator initialized with OpenAI models")

    def get_evaluation_questions(self) -> List[Dict[str, str]]:
        """Get curated evaluation questions for RAGAS testing"""
        return [
            {
                "question": "What is the maximum credit limit for the Aven HELOC card?",
                "ground_truth": "The maximum credit limit is $250,000, subject to your home equity and creditworthiness."
            },
            {
                "question": "What are the interest rates for Aven?",
                "ground_truth": "Variable interest rates range from 7.99% to 15.49%, with a maximum of 18% during the life of the account."
            },
            {
                "question": "Is there an annual fee for the Aven card?",
                "ground_truth": "No, there is no annual fee for the Aven HELOC Credit Card."
            },
            {
                "question": "How much cashback do I earn with Aven?",
                "ground_truth": "You earn 2% cashback on all purchases and 7% cashback on travel booked through Aven's travel portal."
            },
            {
                "question": "Does Aven make any money from Debt Protection?",
                "ground_truth": "No, Aven does not make any money from this product. We offer it solely to provide our customers with peace of mind when using their home equity. The costs charged are passed directly through from Securian Financial."
            },
            {
                "question": "How fast can I get approved for an Aven card?",
                "ground_truth": "Approval can be as fast as 5 minutes for qualified applicants."
            },
            {
                "question": "What credit score do I need for Aven?",
                "ground_truth": "Typically a credit score of 600 or higher is required, though other factors are also considered."
            },
            {
                "question": "What bank issues the Aven card?",
                "ground_truth": "The Aven Visa Credit Card is issued by Coastal Community Bank."
            },
            {
                "question": "Is there an autopay discount available?",
                "ground_truth": "Yes, there is a 0.25% autopay discount available."
            },
            {
                "question": "Can I transfer balances to my Aven card?",
                "ground_truth": "Yes, balance transfers are available with a 2.5% fee."
            },
            {
                "question": "What income do I need to qualify for Aven?",
                "ground_truth": "You typically need stable income of $50,000 or more annually."
            },
            {
                "question": "How much home equity do I need for Aven?",
                "ground_truth": "You typically need at least $250,000 in home equity after existing mortgages and liens."
            }
        ]

    def query_rag_pipeline(self, question: str) -> Dict[str, Any]:
        """Query the local RAG pipeline"""
        try:
            response = requests.post(
                'http://localhost:3002/api/chat',
                json={
                    'message': question,
                    'userId': 'ragas-eval'
                },
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    'answer': data.get('answer', ''),
                    'contexts': [source.get('content', '') for source in data.get('sources', [])],
                    'source_documents': data.get('sources', [])
                }
            else:
                print(f"❌ API Error {response.status_code}: {response.text}")
                return {'answer': '', 'contexts': [], 'source_documents': []}
                
        except Exception as e:
            print(f"❌ Error querying RAG pipeline: {e}")
            return {'answer': '', 'contexts': [], 'source_documents': []}

    def prepare_ragas_dataset(self, questions: List[Dict[str, str]]) -> Dataset:
        """Prepare dataset in RAGAS format"""
        print("🔄 Querying RAG pipeline for evaluation questions...")
        
        data = {
            'question': [],
            'answer': [],
            'contexts': [],
            'ground_truth': []
        }
        
        for i, qa in enumerate(questions):
            print(f"   Querying {i+1}/{len(questions)}: {qa['question'][:50]}...")
            
            rag_response = self.query_rag_pipeline(qa['question'])
            
            # Skip failed queries
            if not rag_response['answer']:
                print(f"   ⚠️ Skipping failed query")
                continue
            
            data['question'].append(qa['question'])
            data['answer'].append(rag_response['answer'])
            data['contexts'].append(rag_response['contexts'] if rag_response['contexts'] else ['No context retrieved'])
            data['ground_truth'].append(qa['ground_truth'])
            
            print(f"   ✅ Got response ({len(rag_response['contexts'])} contexts)")
        
        print(f"✅ Prepared dataset with {len(data['question'])} valid examples")
        return Dataset.from_dict(data)

    async def run_ragas_evaluation(self, dataset: Dataset) -> Dict[str, Any]:
        """Run RAGAS evaluation on the dataset"""
        print("🧪 Running RAGAS evaluation...")
        print(f"   Metrics: {[metric.name for metric in self.metrics]}")
        
        try:
            # Run evaluation
            result = evaluate(
                dataset=dataset,
                metrics=self.metrics,
                llm=self.llm,
                embeddings=self.embeddings,
                raise_exceptions=False
            )
            
            print("✅ RAGAS evaluation completed!")
            return result
            
        except Exception as e:
            print(f"❌ RAGAS evaluation failed: {e}")
            return None

    def generate_ragas_report(self, results: Dict[str, Any], dataset: Dataset) -> None:
        """Generate comprehensive RAGAS evaluation report"""
        print("\n" + "="*80)
        print("📊 RAGAS EVALUATION REPORT - INDUSTRY STANDARD RAG METRICS")
        print("="*80)
        
        if not results:
            print("❌ No results to report")
            return
        
        # Overall scores
        print("\n🎯 OVERALL RAGAS SCORES:")
        metrics_scores = {}
        
        for metric in self.metrics:
            metric_name = metric.name
            if metric_name in results:
                score = results[metric_name]
                metrics_scores[metric_name] = score
                print(f"   {metric_name:20}: {score:.3f} ({self.get_score_interpretation(metric_name, score)})")
        
        # Calculate overall RAGAS score
        if metrics_scores:
            overall_score = sum(metrics_scores.values()) / len(metrics_scores)
            grade = self.get_overall_grade(overall_score)
            print(f"\n🎓 OVERALL RAGAS SCORE: {overall_score:.3f} ({grade})")
        
        # Detailed breakdown
        print("\n📋 METRICS BREAKDOWN:")
        
        print("\n   🔍 FAITHFULNESS:", f"{results.get('faithfulness', 0):.3f}")
        print("      Measures how grounded the answer is in the retrieved context")
        print("      Higher = answer is more factually grounded in sources")
        
        print("\n   🎯 ANSWER RELEVANCY:", f"{results.get('answer_relevancy', 0):.3f}")
        print("      Measures how relevant the answer is to the question")
        print("      Higher = answer directly addresses the question")
        
        print("\n   📚 CONTEXT PRECISION:", f"{results.get('context_precision', 0):.3f}")
        print("      Measures how relevant the retrieved contexts are")
        print("      Higher = retrieved contexts are more relevant to the question")
        
        print("\n   🔄 CONTEXT RECALL:", f"{results.get('context_recall', 0):.3f}")
        print("      Measures how well the retrieval captures relevant information")
        print("      Higher = better retrieval of relevant context")
        
        print("\n   📝 ANSWER SIMILARITY:", f"{results.get('answer_similarity', 0):.3f}")
        print("      Semantic similarity between generated and expected answer")
        print("      Higher = answer is more similar to expected response")
        
        print("\n   ✅ ANSWER CORRECTNESS:", f"{results.get('answer_correctness', 0):.3f}")
        print("      Overall correctness considering both similarity and accuracy")
        print("      Higher = answer is more correct and accurate")
        
        # Performance insights
        print("\n💡 RAGAS INSIGHTS:")
        
        faithfulness_score = results.get('faithfulness', 0)
        if faithfulness_score < 0.7:
            print("   ⚠️ Low faithfulness - answers may not be well-grounded in sources")
        elif faithfulness_score > 0.8:
            print("   ✅ Excellent faithfulness - answers are well-grounded in retrieved context")
        
        relevancy_score = results.get('answer_relevancy', 0)
        if relevancy_score < 0.7:
            print("   ⚠️ Low answer relevancy - responses may be off-topic")
        elif relevancy_score > 0.8:
            print("   ✅ Excellent relevancy - answers directly address questions")
        
        precision_score = results.get('context_precision', 0)
        if precision_score < 0.7:
            print("   ⚠️ Low context precision - retrieval may include irrelevant information")
        elif precision_score > 0.8:
            print("   ✅ Excellent precision - retrieved contexts are highly relevant")
        
        recall_score = results.get('context_recall', 0)
        if recall_score < 0.7:
            print("   ⚠️ Low context recall - may miss relevant information")
        elif recall_score > 0.8:
            print("   ✅ Excellent recall - captures relevant information effectively")
        
        # Comparison with custom evaluation
        print("\n🔄 COMPARISON WITH CUSTOM EVALUATION:")
        print("   Custom Accuracy:     76.4% (Your evaluation)")
        print("   RAGAS Correctness:   {:.1f}% (Industry standard)".format(results.get('answer_correctness', 0) * 100))
        print("   Custom Helpfulness:  92.7% (Your evaluation)")
        print("   RAGAS Relevancy:     {:.1f}% (Industry standard)".format(results.get('answer_relevancy', 0) * 100))
        
        # Recommendations
        print("\n🔧 RAGAS-BASED RECOMMENDATIONS:")
        if faithfulness_score < 0.8:
            print("   • Improve grounding: Ensure answers stick closely to retrieved context")
        if precision_score < 0.8:
            print("   • Enhance retrieval: Filter out irrelevant context before generation")
        if recall_score < 0.8:
            print("   • Expand knowledge base: Add more comprehensive coverage")
        if relevancy_score < 0.8:
            print("   • Improve generation: Train model to be more focused on the question")
        
        print("\n" + "="*80)
        
        # Save detailed results
        report_data = {
            'timestamp': pd.Timestamp.now().isoformat(),
            'ragas_scores': metrics_scores,
            'overall_score': overall_score,
            'grade': grade,
            'detailed_results': dict(results),
            'dataset_size': len(dataset),
            'evaluation_questions': len(dataset)
        }
        
        with open('ragas-evaluation-results.json', 'w') as f:
            json.dump(report_data, f, indent=2, default=str)
        
        print("💾 Detailed RAGAS results saved to: ragas-evaluation-results.json")

    def get_score_interpretation(self, metric: str, score: float) -> str:
        """Get interpretation of RAGAS score"""
        if score >= 0.8:
            return "Excellent"
        elif score >= 0.7:
            return "Good"
        elif score >= 0.6:
            return "Fair"
        elif score >= 0.5:
            return "Poor"
        else:
            return "Very Poor"

    def get_overall_grade(self, score: float) -> str:
        """Convert overall score to letter grade"""
        if score >= 0.9:
            return "A+"
        elif score >= 0.8:
            return "A"
        elif score >= 0.7:
            return "B"
        elif score >= 0.6:
            return "C"
        elif score >= 0.5:
            return "D"
        else:
            return "F"

async def main():
    """Main evaluation function"""
    print("🚀 Starting RAGAS Evaluation for Aven AI Customer Agent")
    print("="*60)
    
    try:
        # Initialize evaluator
        evaluator = RAGASEvaluator()
        
        # Get evaluation questions
        questions = evaluator.get_evaluation_questions()
        print(f"📝 Loaded {len(questions)} evaluation questions")
        
        # Prepare RAGAS dataset
        dataset = evaluator.prepare_ragas_dataset(questions)
        
        if len(dataset) == 0:
            print("❌ No valid data for evaluation. Check if your server is running.")
            return
        
        # Run RAGAS evaluation
        results = await evaluator.run_ragas_evaluation(dataset)
        
        if results:
            # Generate report
            evaluator.generate_ragas_report(results, dataset)
        else:
            print("❌ RAGAS evaluation failed")
            
    except Exception as e:
        print(f"❌ Error in main evaluation: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())