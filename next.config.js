/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    PINECONE_API_KEY: process.env.PINECONE_API_KEY,
    PINECONE_ENVIRONMENT: process.env.PINECONE_ENVIRONMENT,
    VAPI_PUBLIC_KEY: process.env.VAPI_PUBLIC_KEY,
    VAPI_PRIVATE_KEY: process.env.VAPI_PRIVATE_KEY,
    EXA_API_KEY: process.env.EXA_API_KEY,
  },
}

module.exports = nextConfig
