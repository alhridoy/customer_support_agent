# Aven AI Customer Support Agent

A production-ready AI customer support system built for Aven's HELOC Credit Card, featuring advanced RAG architecture, voice interface integration, and comprehensive evaluation framework.

## 🎯 System Design Overview

This system solves the complete customer support challenge through a sophisticated multi-modal AI architecture that provides accurate, source-backed responses across text and voice interfaces.

### Core Problem Solved
- **Challenge**: Provide accurate, real-time customer support for complex financial products
- **Solution**: Multi-modal RAG system with voice integration and continuous evaluation
- **Result**: 84.5% overall performance with 92.7% helpfulness score

## 🏗️ System Architecture

```mermaid
graph TB
    subgraph "🎯 User Interfaces"
        UI1[Web Chat Interface]
        UI2[Voice Interface (VAPI)]
    end

    subgraph "🧠 Core Processing Engine"
        PROC1[RAG Pipeline]
        PROC2[Agentic Retrieval]
        PROC3[Response Generation]
    end

    subgraph "📚 Knowledge & Memory Layer"
        KB1[Pinecone Vector DB<br/>Aven.com Content]
        KB2[MEM0 Memory<br/>Conversation Context]
        KB3[Semantic Cache]
    end

    subgraph "🤖 AI Models"
        AI1[GPT-4.1-mini<br/>Response Generation]
        AI2[text-embedding-3-small<br/>Vector Embeddings]
    end

    subgraph "🧪 Evaluation & Monitoring"
        EVAL1[RAGAS Framework]
        EVAL2[Custom Metrics]
        EVAL3[Real-time Monitoring]
    end

    UI1 --> PROC1
    UI2 --> PROC1
    PROC1 --> PROC2
    PROC2 --> KB1
    PROC1 --> KB2
    PROC1 --> KB3
    PROC1 --> AI1
    KB1 --> AI2
    PROC3 --> EVAL1
    PROC3 --> EVAL2
    PROC3 --> EVAL3
```

## 🔄 End-to-End Processing Flow

### 1. **Query Processing**
```
User Query → Query Analysis → Intent Classification → Context Retrieval
```

### 2. **Multi-Strategy Retrieval**
```
Vector Search + Keyword Search + Memory Retrieval → Document Ranking → Context Assembly
```

### 3. **Response Generation**
```
Context + Query + Memory → GPT-4.1-mini → Structured Response → Source Attribution
```

### 4. **Quality Assurance**
```
Response → RAGAS Evaluation → Custom Metrics → Performance Tracking → Continuous Improvement
```

## 🚀 Key System Components

### RAG Pipeline Architecture
- **Multi-Step Processing**: 6-stage pipeline with real-time progress tracking
- **Agentic Retrieval**: Self-improving search with multiple strategies
- **Hierarchical Context**: Document and chunk-level processing
- **Source Attribution**: All responses include verifiable citations

### Voice Integration
- **VAPI Integration**: Natural voice conversations with context retention
- **Real-time Processing**: Sub-10 second response times
- **Voice Optimization**: Optimized prompts for conversational delivery

### Memory System
- **Conversation Memory**: Persistent context using MEM0
- **Semantic Caching**: Query optimization for faster responses
- **Learning Capability**: Continuous improvement from interactions

### Evaluation Framework
- **Dual Assessment**: RAGAS industry standards + custom metrics
- **Real-time Monitoring**: Every interaction evaluated automatically
- **Performance Tracking**: Category-wise analysis and trend monitoring

## 📊 Performance Metrics

| Metric | Score | Grade | Description |
|--------|-------|-------|-------------|
| **Overall Performance** | 84.5% | A | Combined system effectiveness |
| **Accuracy** | 76.4% | B+ | Factual correctness |
| **Helpfulness** | 92.7% | A+ | User satisfaction and completeness |
| **Response Time** | 6.81s | B | Average processing speed |
| **Source Quality** | 5.0 avg | A | Retrieved document relevance |

## 🛠️ Technology Stack

### Core Technologies
- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes, Node.js
- **AI Models**: OpenAI GPT-4.1-mini, text-embedding-3-small
- **Vector Database**: Pinecone (1024 dimensions)
- **Memory**: MEM0 AI for conversation context
- **Voice**: VAPI for natural voice interactions

### Infrastructure
- **Monitoring**: LangFuse for observability and analytics
- **Evaluation**: RAGAS + custom metrics framework
- **Content Processing**: Advanced chunking for large documents
- **Caching**: Semantic caching for performance optimization

## 🚀 Quick Start

### Prerequisites
```bash
Node.js 18+, OpenAI API key, Pinecone account, VAPI account
```

### Installation
```bash
# Clone and setup
git clone https://github.com/alhridoy/customer_support_agent.git
cd customer_support_agent
npm install

# Configure environment
cp .env.local.example .env.local
# Add your API keys to .env.local

# Initialize knowledge base
npm run scrape

# Start development server
npm run dev
```

### Environment Variables
```env
# Required API Keys
OPENAI_API_KEY=your_openai_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=aven-support-index
NEXT_PUBLIC_VAPI_PUBLIC_KEY=your_vapi_public_key
VAPI_PRIVATE_KEY=your_vapi_private_key
MEM0_API_KEY=your_mem0_api_key
LANGFUSE_PUBLIC_KEY=your_langfuse_public_key
LANGFUSE_SECRET_KEY=your_langfuse_secret_key
```

## 🧪 Evaluation System

### Comprehensive Testing
```bash
# Run full evaluation suite
node run-eval.js --full

# Industry-standard RAGAS evaluation
python3 ragas-evaluation.py

# Enhanced custom evaluation
python3 enhanced-rag-evaluation.py

# System health check
node run-eval.js --rag-health
```

### Evaluation Categories
- **Product Features**: Credit limits, benefits, features
- **Rates & Fees**: Interest rates, annual fees, charges
- **Rewards**: Cashback rates, travel benefits
- **Eligibility**: Requirements, credit scores, qualifications
- **Application Process**: Steps, timing, documentation
- **Partnerships**: Bank relationships, integrations

## 🌐 API Endpoints

### Core APIs
- `POST /api/chat` - Main text chat with RAG pipeline
- `POST /api/voice/webhook` - VAPI voice interface webhook
- `POST /api/evaluate` - Comprehensive evaluation system
- `GET/POST /api/meetings` - Meeting scheduler

### Usage Example
```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "What are Aven's interest rates?",
    sessionId: "user-session-123"
  })
});
```

## 🎯 System Highlights

### Production Features
- **Multi-Interface Support**: Seamless web and voice interactions
- **Advanced RAG**: Agentic retrieval with multiple search strategies
- **Real-time Evaluation**: Continuous quality monitoring
- **Source Attribution**: All responses cite verifiable sources
- **Memory Integration**: Conversation context and learning
- **Performance Monitoring**: Comprehensive analytics and alerting

### Technical Excellence
- **Latest AI Models**: GPT-4.1-mini with 1M token context window
- **Optimized Performance**: Sub-10 second response times
- **Scalable Architecture**: Modular, testable, maintainable design
- **Error Handling**: Graceful fallbacks and recovery mechanisms
- **Security**: Content moderation and safety guardrails

## 📈 System Performance

### Response Quality
- **Grade A Performance**: 84.5% overall effectiveness
- **High Helpfulness**: 92.7% user satisfaction
- **Accurate Information**: 76.4% factual correctness
- **Fast Processing**: 6.8 second average response time

### Scalability Metrics
- **Knowledge Base**: 19+ curated knowledge items
- **Vector Dimensions**: 1024-dimensional embeddings
- **Context Window**: 1M token capacity
- **Evaluation Coverage**: 15 comprehensive test scenarios

## 🔧 Development

### Project Structure
```
src/
├── app/api/          # API endpoints
├── lib/              # Core libraries (RAG, OpenAI, Pinecone)
├── utils/            # Utility functions
└── types/            # TypeScript definitions

Root files:
├── run-eval.js       # Evaluation runner
├── ragas-evaluation.py    # RAGAS framework
├── enhanced-rag-evaluation.py  # Custom metrics
└── evals.md          # Evaluation documentation
```

### Key Design Decisions
1. **RAG-First Architecture**: All responses grounded in verified sources
2. **Multi-Modal Design**: Unified processing for text and voice
3. **Evaluation-Driven Development**: Continuous quality measurement
4. **Memory Integration**: Persistent conversation context
5. **Performance Optimization**: Caching and efficient retrieval

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

Built for Aven's HELOC Credit Card customer support with focus on accuracy, performance, and user experience.

---

**System Grade: A (84.5%) | Response Time: 6.8s | Helpfulness: 92.7%**