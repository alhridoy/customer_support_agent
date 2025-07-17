import { z } from 'zod'

// Environment configuration schema
const configSchema = z.object({
  // OpenAI Configuration
  OPENAI_API_KEY: z.string().min(1, 'OpenAI API key is required'),
  
  // Pinecone Configuration
  PINECONE_API_KEY: z.string().min(1, 'Pinecone API key is required'),
  PINECONE_INDEX_NAME: z.string().default('aven-support-index'),
  PINECONE_ENVIRONMENT: z.string().optional(),
  
  // VAPI Configuration
  VAPI_PUBLIC_KEY: z.string().optional(),
  VAPI_PRIVATE_KEY: z.string().optional(),
  VAPI_ASSISTANT_ID: z.string().optional(),
  
  // MEM0 Configuration
  MEM0_API_KEY: z.string().optional(),
  
  // Exa AI Configuration
  EXA_API_KEY: z.string().optional(),
  
  // LangFuse Configuration
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_HOST: z.string().default('https://us.cloud.langfuse.com'),
  
  // Application Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
})

// Parse and validate environment variables
function loadConfig() {
  try {
    return configSchema.parse({
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      PINECONE_API_KEY: process.env.PINECONE_API_KEY,
      PINECONE_INDEX_NAME: process.env.PINECONE_INDEX_NAME,
      PINECONE_ENVIRONMENT: process.env.PINECONE_ENVIRONMENT,
      VAPI_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || process.env.VAPI_PUBLIC_KEY,
      VAPI_PRIVATE_KEY: process.env.VAPI_PRIVATE_KEY,
      VAPI_ASSISTANT_ID: process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || process.env.VAPI_ASSISTANT_ID,
      MEM0_API_KEY: process.env.MEM0_API_KEY,
      EXA_API_KEY: process.env.EXA_API_KEY,
      LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
      LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
      LANGFUSE_HOST: process.env.LANGFUSE_HOST,
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join('\n')
      throw new Error(`Configuration validation failed:\n${missingVars}`)
    }
    throw error
  }
}

// Export validated configuration
export const config = loadConfig()

// Type-safe configuration object
export type Config = z.infer<typeof configSchema>

// Helper functions for specific configurations
export const openaiConfig = {
  apiKey: config.OPENAI_API_KEY,
}

export const pineconeConfig = {
  apiKey: config.PINECONE_API_KEY,
  indexName: config.PINECONE_INDEX_NAME,
  environment: config.PINECONE_ENVIRONMENT,
}

export const vapiConfig = {
  publicKey: config.VAPI_PUBLIC_KEY,
  privateKey: config.VAPI_PRIVATE_KEY,
  assistantId: config.VAPI_ASSISTANT_ID,
}

export const mem0Config = {
  apiKey: config.MEM0_API_KEY,
}

export const exaConfig = {
  apiKey: config.EXA_API_KEY,
}

export const langfuseConfig = {
  publicKey: config.LANGFUSE_PUBLIC_KEY,
  secretKey: config.LANGFUSE_SECRET_KEY,
  host: config.LANGFUSE_HOST,
}

// Validation helpers
export const isConfigured = {
  openai: () => !!config.OPENAI_API_KEY,
  pinecone: () => !!config.PINECONE_API_KEY,
  vapi: () => !!config.VAPI_PRIVATE_KEY && !!config.VAPI_PUBLIC_KEY,
  mem0: () => !!config.MEM0_API_KEY,
  exa: () => !!config.EXA_API_KEY,
  langfuse: () => !!config.LANGFUSE_PUBLIC_KEY && !!config.LANGFUSE_SECRET_KEY,
}
