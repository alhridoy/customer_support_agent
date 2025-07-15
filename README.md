# React RAG Evaluation Project

A React application with integrated RAG (Retrieval-Augmented Generation) evaluation tools for testing and measuring accuracy of AI-powered retrieval systems.

## Features

- React frontend with Tailwind CSS styling
- RAG evaluation scripts (JavaScript and Python)
- Evaluation dataset for testing
- Automated accuracy measurement tools

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Python 3.8+ (for evaluation scripts)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd <project-directory>
```

2. Install dependencies:
```bash
npm install
```

3. Install Python dependencies (if using Python evaluation):
```bash
pip install -r requirements.txt
```

### Running the Project

1. Start the development server:
```bash
npm start
```

2. Run RAG evaluation:
```bash
node run-eval.js
# or
python enhanced-rag-evaluation.py
```

## Project Structure

- `tailwind.config.js` - Tailwind CSS configuration
- `run-eval.js` - JavaScript evaluation runner
- `evaluate-rag-accuracy.js` - RAG accuracy evaluation logic
- `enhanced-rag-evaluation.py` - Python-based evaluation script
- `evaluation-dataset.json` - Test dataset for evaluations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License