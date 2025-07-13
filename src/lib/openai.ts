import OpenAI from 'openai'
import { AvenKnowledgeItem } from '@/types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function generateResponse(
  query: string,
  relevantDocs: AvenKnowledgeItem[],
  memoryContext?: string,
  customPrompt?: string
): Promise<string> {
  try {
    const context = relevantDocs.map(doc => 
      `Title: ${doc.title}\nContent: ${doc.content}\nSource: ${doc.url}\n`
    ).join('\n---\n')

    const systemPrompt = `You are a helpful customer support assistant for Aven, a financial technology company that offers a HELOC (Home Equity Line of Credit) Credit Card for homeowners.

Key information about Aven:
- Aven provides a HELOC Credit Card that allows homeowners to access their home equity
- Credit limits up to $250,000
- Interest rates from 7.99% - 15.49% (variable), max 18%
- 2% cashback on all purchases, 7% on travel through Aven's portal
- No annual fee, no notarization fee
- Approval as fast as 5 minutes
- Powered by Visa network, partnered with Coastal Community Bank
- 0.25% autopay discount available

FORMATTING REQUIREMENTS:
1. Structure your responses with clear headings and bullet points
2. Use markdown formatting for better readability
3. Add inline citations using [^1], [^2] format when referencing specific information
4. Keep responses well-organized and scannable
5. Use bullet points for lists and features
6. Include relevant emojis sparingly for visual appeal

CITATION FORMAT:
- Add inline citations like [^1] immediately after claims that come from sources
- Reference sources by their titles, not URLs
- Make citations clickable and helpful

Your role:
1. Answer questions about Aven's HELOC Credit Card and services
2. Help customers understand features, benefits, and application process
3. Provide helpful, accurate information based on the context provided
4. Structure responses professionally with clear formatting
5. Always cite sources when providing specific information
6. If you don't know something, admit it and suggest contacting Aven directly

Remember:
- Don't provide personal financial advice
- Don't access or discuss specific account information
- Don't provide legal advice
- Keep responses professional and helpful
- Use clear, structured formatting with headings and bullet points`

    const userPrompt = customPrompt || `Question: ${query}

Context from knowledge base:
${context}

${memoryContext ? `Memory/Conversation Context:
${memoryContext}

` : ''}Please provide a well-structured, helpful response based on the context provided. Follow these guidelines:

STRUCTURE YOUR RESPONSE:
1. Start with a brief, direct answer
2. Use clear headings (## for main sections)
3. Use bullet points for lists and features
4. Add inline citations [^1] when referencing specific information
5. End with a helpful summary or next steps

EXAMPLE FORMAT:
## Key Features
- **Feature 1**: Description [^1]
- **Feature 2**: Description [^2]

## Important Details
Brief explanation with citations [^1]

If the context doesn't contain enough information to answer the question, say so and suggest contacting Aven directly.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    })

    return response.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response. Please try again or contact Aven customer support directly.'
  } catch (error) {
    console.error('Error generating response:', error)
    throw error
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      dimensions: 1024, // Match your Pinecone index dimensions (1024 for text-embedding-3-small)
    })

    return response.data[0].embedding
  } catch (error) {
    console.error('Error generating embedding:', error)
    throw error
  }
}
