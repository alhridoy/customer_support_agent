import { NextRequest, NextResponse } from 'next/server'
import { scrapeAvenData, updateKnowledgeBaseComprehensive, comprehensiveSiteSearch, getManualKnowledgeItems } from '@/lib/scraper'
import { addToKnowledgeBase } from '@/lib/pinecone'

// Track scraping progress
let scrapingInProgress = false
let scrapingProgress = {
  status: 'idle',
  startTime: null as Date | null,
  itemsProcessed: 0,
  totalEstimated: 0,
  currentTask: '',
  errors: [] as string[]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { comprehensive = false, mode = 'full', testMode = false, onlyManual = false } = body

    // Check if scraping is already in progress
    if (scrapingInProgress) {
      return NextResponse.json({
        error: 'Scraping already in progress',
        progress: scrapingProgress
      }, { status: 409 })
    }

    // Initialize progress tracking
    scrapingInProgress = true
    scrapingProgress = {
      status: 'starting',
      startTime: new Date(),
      itemsProcessed: 0,
      totalEstimated: comprehensive ? 500 : 100,
      currentTask: comprehensive ? 'Comprehensive site scraping' : 'Targeted content scraping',
      errors: []
    }

    console.log(`🚀 Starting ${comprehensive ? 'comprehensive' : 'targeted'} knowledge base update...`)

    let results
    let itemCount: number | string = 0

    try {
      if (onlyManual || testMode) {
        // Manual knowledge items only (for testing)
        scrapingProgress.currentTask = 'Adding manual knowledge items'
        scrapingProgress.totalEstimated = 5
        
        const manualItems = getManualKnowledgeItems()
        console.log(`📝 Adding ${manualItems.length} manual knowledge items...`)
        
        for (const item of manualItems) {
          try {
            await addToKnowledgeBase(item)
            console.log(`✅ Added: ${item.title}`)
            scrapingProgress.itemsProcessed++
          } catch (error) {
            console.error(`❌ Error adding manual item ${item.id}:`, error)
            scrapingProgress.errors.push(`Failed to add ${item.title}`)
          }
        }
        
        results = manualItems
        itemCount = manualItems.length
      } else if (comprehensive) {
        if (mode === 'comprehensive-only') {
          // Only run comprehensive search
          scrapingProgress.currentTask = 'Running comprehensive site search'
          results = await comprehensiveSiteSearch()
          itemCount = results.length
        } else {
          // Run both targeted and comprehensive
          scrapingProgress.currentTask = 'Running full comprehensive update'
          await updateKnowledgeBaseComprehensive()
          itemCount = 'comprehensive'
        }
      } else {
        // Targeted scraping only
        scrapingProgress.currentTask = 'Running targeted content scraping'
        results = await scrapeAvenData()
        itemCount = results.length
      }

      scrapingProgress.status = 'completed'
      scrapingProgress.itemsProcessed = typeof itemCount === 'number' ? itemCount : 0

    } catch (error) {
      scrapingProgress.status = 'error'
      scrapingProgress.errors.push(error instanceof Error ? error.message : 'Unknown error')
      throw error
    } finally {
      scrapingInProgress = false
    }

    const duration = scrapingProgress.startTime
      ? Date.now() - scrapingProgress.startTime.getTime()
      : 0

    console.log(`✅ Scraping completed in ${Math.round(duration / 1000)}s`)

    return NextResponse.json({
      success: true,
      message: comprehensive
        ? 'Successfully completed comprehensive site scraping'
        : `Successfully scraped and added ${itemCount} items to knowledge base`,
      itemCount,
      type: comprehensive ? 'comprehensive' : 'targeted',
      mode,
      duration: Math.round(duration / 1000),
      progress: scrapingProgress
    })
  } catch (error) {
    console.error('❌ Error in scrape API:', error)
    scrapingInProgress = false
    scrapingProgress.status = 'error'

    return NextResponse.json(
      {
        error: 'Failed to scrape data',
        details: error instanceof Error ? error.message : 'Unknown error',
        progress: scrapingProgress
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Scraping API Status',
    endpoint: '/api/scrape',
    inProgress: scrapingInProgress,
    progress: scrapingProgress,
    usage: {
      'POST /api/scrape': 'Start targeted scraping',
      'POST /api/scrape {"comprehensive": true}': 'Start comprehensive scraping (targeted + comprehensive)',
      'POST /api/scrape {"comprehensive": true, "mode": "comprehensive-only"}': 'Start comprehensive-only scraping',
      'GET /api/scrape': 'Get current status and progress'
    }
  })
}
