import { NextRequest, NextResponse } from 'next/server'
import { createVoiceTrace } from '@/lib/langfuse'
import { Langfuse } from 'langfuse'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debug LangFuse in Next.js environment...')
    
    // Check environment variables
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY
    const secretKey = process.env.LANGFUSE_SECRET_KEY
    const host = process.env.LANGFUSE_HOST
    
    console.log('Environment Variables:')
    console.log('LANGFUSE_PUBLIC_KEY:', publicKey ? `Set (${publicKey.length} chars)` : 'Not set')
    console.log('LANGFUSE_SECRET_KEY:', secretKey ? `Set (${secretKey.length} chars)` : 'Not set') 
    console.log('LANGFUSE_HOST:', host || 'Not set')
    
    if (!publicKey || !secretKey) {
      return NextResponse.json({
        error: 'LangFuse credentials not properly set',
        publicKey: !!publicKey,
        secretKey: !!secretKey,
        host: !!host
      })
    }
    
    // Test direct LangFuse initialization
    console.log('Testing direct LangFuse initialization...')
    const langfuse = new Langfuse({
      publicKey,
      secretKey,
      baseUrl: host,
      flushAt: 1,
      requestTimeout: 10000
    })
    
    // Create a simple test trace
    console.log('Creating test trace...')
    const testTrace = langfuse.trace({
      sessionId: `debug_${Date.now()}`,
      userId: 'debug_user',
      name: 'debug_test',
      input: { test: 'debug_input' },
      tags: ['debug', 'test'],
      metadata: {
        test: true,
        timestamp: new Date().toISOString()
      }
    })
    
    console.log('Test trace created with ID:', testTrace.id)
    
    // Add a span
    const span = testTrace.span({
      name: 'debug_span',
      input: { span_test: 'debug_span_input' },
      output: { span_result: 'debug_span_output' },
      metadata: { span_test: true }
    })
    span.end()
    console.log('Test span added')
    
    // Update trace
    testTrace.update({
      output: { result: 'debug_output', success: true },
      metadata: { completed: true }
    })
    console.log('Test trace updated')
    
    // Flush
    await langfuse.flushAsync()
    console.log('Test trace flushed to LangFuse')
    
    // Now test our VoiceTracer
    console.log('Testing VoiceTracer class...')
    const voiceTracer = createVoiceTrace('debug_voice_call', 'debug_user', 'Test voice message')
    
    // Add a voice step
    voiceTracer.logVoiceStep('test_step', 
      { test_input: 'voice_input' },
      { test_output: 'voice_output' },
      { test_metadata: true }
    )
    console.log('Voice step added')
    
    // Complete voice trace
    await voiceTracer.endTrace(
      { voice_result: 'debug_voice_complete' },
      { voice_success: true }
    )
    console.log('Voice trace completed')
    
    return NextResponse.json({
      success: true,
      langfuseConfigured: true,
      testTraceId: testTrace.id,
      voiceTracerId: voiceTracer.getTraceId(),
      message: 'LangFuse debug test completed successfully'
    })
    
  } catch (error) {
    console.error('❌ Error in LangFuse debug:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}