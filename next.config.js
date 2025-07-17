/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Only expose public keys to client-side
    // Private keys (VAPI_PRIVATE_KEY, EXA_API_KEY, OPENAI_API_KEY, PINECONE_API_KEY)
    // are accessed directly in API routes for security
    VAPI_PUBLIC_KEY: process.env.VAPI_PUBLIC_KEY,
  },
}

module.exports = nextConfig
