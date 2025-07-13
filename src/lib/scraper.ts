import { Exa } from 'exa-js'
import { AvenKnowledgeItem } from '@/types'
import { addToKnowledgeBase } from './pinecone'

const exa = new Exa(process.env.EXA_API_KEY || '')

// Rate limiting and deduplication
const RATE_LIMIT_DELAY = 1000 // 1 second between requests
const processedUrls = new Set<string>()
const processedContent = new Set<string>() // Track content hashes to avoid duplicates

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Simple content hash function for deduplication
function getContentHash(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return hash.toString()
}

// Enhanced error handling with retry logic
async function safeExaRequest<T>(
  requestFn: () => Promise<T>,
  maxRetries: number = 3,
  context: string = 'request'
): Promise<T | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn()
    } catch (error: any) {
      console.error(`❌ Attempt ${attempt}/${maxRetries} failed for ${context}:`, error.message)

      if (attempt === maxRetries) {
        console.error(`🚫 Max retries reached for ${context}`)
        return null
      }

      // Exponential backoff
      const backoffDelay = RATE_LIMIT_DELAY * Math.pow(2, attempt - 1)
      console.log(`⏳ Waiting ${backoffDelay}ms before retry...`)
      await delay(backoffDelay)
    }
  }
  return null
}

// Content quality filter
function isQualityContent(content: string, title: string): boolean {
  if (!content || content.length < 200) return false

  // Skip if content is mostly navigation or boilerplate
  const lowQualityIndicators = [
    'javascript is disabled',
    'enable javascript',
    'cookie policy',
    'loading...',
    'please wait',
    'error 404',
    'page not found',
    'access denied'
  ]

  const lowerContent = content.toLowerCase()
  if (lowQualityIndicators.some(indicator => lowerContent.includes(indicator))) {
    return false
  }

  // Check for reasonable content-to-navigation ratio
  const words = content.split(/\s+/).length
  if (words < 50) return false

  return true
}

export async function scrapeAvenData() {
  try {
    console.log('Starting comprehensive Aven data scraping...')

    // Clear processed URLs for this session
    processedUrls.clear()

    // Comprehensive search queries covering all aspects of Aven
    const searchQueries = [
      // Core product information
      'Aven HELOC credit card features benefits',
      'Aven home equity line of credit application process',
      'Aven credit card interest rates fees',
      'Aven credit card rewards cashback travel',
      'Aven homeowner financial services',

      // Application and eligibility
      'Aven credit card eligibility requirements',
      'Aven application approval process',
      'Aven credit score requirements minimum',
      'Aven income verification process',
      'Aven home equity calculation requirements',

      // Customer support and service
      'Aven customer support FAQ help',
      'Aven contact customer service phone',
      'Aven customer reviews testimonials',
      'Aven account management portal login',
      'Aven mobile app features download',

      // Product comparisons and features
      'Aven vs traditional credit cards comparison',
      'Aven balance transfer options fees',
      'Aven autopay discount benefits',
      'Aven travel rewards booking portal',
      'Aven cashback rewards program',

      // Legal and policy information
      'Aven terms conditions privacy policy',
      'Aven security fraud protection',
      'Aven legal disclosures agreements',

      // Educational content
      'Aven education HELOC guide',
      'Aven homeowner financial tips',
      'Aven credit card best practices',

      // Company information
      'Aven about company team',
      'Aven news updates announcements',
      'Aven partnerships bank relationships',
    ]

    const allResults: AvenKnowledgeItem[] = []
    let totalProcessed = 0

    console.log(`Processing ${searchQueries.length} search queries...`)

    for (let i = 0; i < searchQueries.length; i++) {
      const query = searchQueries[i]
      try {
        console.log(`[${i + 1}/${searchQueries.length}] Searching: "${query}"`)

        const searchResult = await exa.search(query, {
          numResults: 15, // Increased for more comprehensive coverage
          includeDomains: ['aven.com'],
        })

        console.log(`Found ${searchResult.results.length} results for "${query}"`)

        for (const result of searchResult.results) {
          // Skip if we've already processed this URL
          if (processedUrls.has(result.url)) {
            continue
          }

          try {
            // Add rate limiting
            await delay(RATE_LIMIT_DELAY)

            // Get the full content with retry logic
            const contentResult = await safeExaRequest(
              () => exa.getContents([result.id]),
              3,
              `content for ${result.url}`
            )

            if (contentResult?.results && contentResult.results.length > 0) {
              const content = contentResult.results[0]

              // Quality check
              if (!isQualityContent(content.text || '', result.title || '')) {
                console.log(`⏭️  Skipping low-quality content: ${result.title}`)
                continue
              }

              // Check for duplicate content
              const contentHash = getContentHash(content.text || '')
              if (processedContent.has(contentHash)) {
                console.log(`⏭️  Skipping duplicate content: ${result.title}`)
                continue
              }

              const knowledgeItem: AvenKnowledgeItem = {
                id: `aven-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
                title: result.title || 'Untitled',
                content: content.text || result.title || 'No content available',
                url: result.url || '',
                category: categorizeContent((result.title || '') + ' ' + (content.text || '')),
              }

              allResults.push(knowledgeItem)
              processedUrls.add(result.url)
              processedContent.add(contentHash)
              totalProcessed++

              console.log(`✓ Processed: ${result.title} (${content.text?.length || 0} chars)`)
            }
          } catch (contentError) {
            console.error(`Error getting content for ${result.url}:`, contentError)
            continue
          }
        }

        // Add delay between queries to respect rate limits
        await delay(RATE_LIMIT_DELAY)

      } catch (error) {
        console.error(`Error searching for "${query}":`, error)
        continue
      }
    }

    // Add additional manual knowledge items
    const manualKnowledgeItems = getManualKnowledgeItems()
    allResults.push(...manualKnowledgeItems)

    // Add all items to knowledge base
    for (const item of allResults) {
      try {
        await addToKnowledgeBase(item)
      } catch (error) {
        console.error(`Error adding item ${item.id} to knowledge base:`, error)
      }
    }

    console.log(`Successfully scraped and added ${allResults.length} items to knowledge base`)
    return allResults
  } catch (error) {
    console.error('Error scraping Aven data:', error)
    throw error
  }
}

function categorizeContent(content: string): string {
  const lowerContent = content.toLowerCase()
  
  if (lowerContent.includes('application') || lowerContent.includes('apply')) {
    return 'application'
  }
  if (lowerContent.includes('interest rate') || lowerContent.includes('apr') || lowerContent.includes('fee')) {
    return 'rates-fees'
  }
  if (lowerContent.includes('cashback') || lowerContent.includes('reward') || lowerContent.includes('travel')) {
    return 'rewards'
  }
  if (lowerContent.includes('heloc') || lowerContent.includes('home equity') || lowerContent.includes('credit line')) {
    return 'heloc'
  }
  if (lowerContent.includes('support') || lowerContent.includes('help') || lowerContent.includes('faq')) {
    return 'support'
  }
  
  return 'general'
}

export function getManualKnowledgeItems(): AvenKnowledgeItem[] {
  return [
    {
      id: 'aven-heloc-overview',
      title: 'Aven HELOC Credit Card Overview',
      content: `The Aven HELOC Credit Card allows homeowners to access their home equity through a convenient credit card. Key features include:
      - Credit limits up to $250,000
      - Interest rates from 7.99% - 15.49% (variable), maximum 18%
      - 2% cashback on all purchases
      - 7% cashback on travel booked through Aven's travel portal
      - No annual fee and no notarization fee
      - Approval as fast as 5 minutes
      - Powered by Visa network
      - Partnered with Coastal Community Bank
      - 0.25% autopay discount available
      - Balance transfer option with 2.5% fee`,
      url: 'https://www.aven.com',
      category: 'heloc',
    },
    {
      id: 'aven-application-process',
      title: 'Aven Application Process',
      content: `To apply for the Aven HELOC Credit Card:
      1. Must be a homeowner with sufficient home equity
      2. Minimum credit score typically around 600
      3. Stable income requirements (usually $50k+ annually)
      4. Home value and equity verification
      5. Quick online application process
      6. Approval decisions as fast as 5 minutes
      7. No notarization required
      The application considers your home equity value, credit score, income, and debt-to-income ratio.`,
      url: 'https://www.aven.com/apply',
      category: 'application',
    },
    {
      id: 'aven-eligibility',
      title: 'Aven Eligibility Requirements',
      content: `Eligibility requirements for Aven HELOC Credit Card:
      - Must be a homeowner
      - Minimum credit score around 600
      - Sufficient home equity (typically $250k+ after mortgages and liens)
      - Stable income (usually $50k+ annually)
      - Home value requirements vary by state
      - Subject to state usury limits
      - Available in most U.S. states
      The exact requirements may vary based on your location and specific financial situation.`,
      url: 'https://www.aven.com/eligibility',
      category: 'application',
    },
    {
      id: 'aven-vs-traditional-credit',
      title: 'Aven vs Traditional Credit Cards',
      content: `Advantages of Aven HELOC Credit Card vs traditional credit cards:
      - Lower interest rates (7.99%-15.49% vs 18%+ typical credit cards)
      - Higher credit limits (up to $250k vs typical $5k-$25k)
      - Secured by home equity (lower risk for lender)
      - Same convenience as regular credit card
      - Better rewards (2% cashback vs typical 1%)
      - No annual fee
      - Interest may be tax-deductible (consult tax advisor)
      However, your home serves as collateral, which is an important consideration.`,
      url: 'https://www.aven.com/compare',
      category: 'heloc',
    },
    {
      id: 'aven-customer-support',
      title: 'Aven Customer Support',
      content: `Aven customer support options:
      - Online account management portal
      - Customer service phone line
      - Email support
      - FAQ section on website
      - Mobile app for account management
      - 24/7 fraud monitoring
      - Live chat support during business hours
      For account-specific questions, customers should log into their account or contact customer service directly.`,
      url: 'https://www.aven.com/support',
      category: 'support',
    },
  ]
}

export async function comprehensiveSiteSearch() {
  try {
    console.log('Starting comprehensive Aven site search...')

    // Use multiple strategies to find all pages on aven.com
    const searchStrategies = [
      // Direct site search
      { query: 'site:aven.com', numResults: 100 },

      // Content-based searches to find different page types
      { query: 'aven.com blog articles news', numResults: 50 },
      { query: 'aven.com support help FAQ', numResults: 50 },
      { query: 'aven.com legal terms privacy', numResults: 30 },
      { query: 'aven.com about company team', numResults: 30 },
      { query: 'aven.com contact information', numResults: 20 },
      { query: 'aven.com education guides tutorials', numResults: 40 },
      { query: 'aven.com reviews testimonials', numResults: 30 },
      { query: 'aven.com application process steps', numResults: 40 },
      { query: 'aven.com features benefits comparison', numResults: 40 },
    ]

    const allResults: AvenKnowledgeItem[] = []
    let totalFound = 0
    let totalProcessed = 0

    console.log(`Using ${searchStrategies.length} search strategies...`)

    for (let i = 0; i < searchStrategies.length; i++) {
      const strategy = searchStrategies[i]
      try {
        console.log(`\n[${i + 1}/${searchStrategies.length}] Strategy: "${strategy.query}" (max ${strategy.numResults} results)`)

        const searchResult = await exa.search(strategy.query, {
          numResults: strategy.numResults,
          includeDomains: ['aven.com'],
        })

        totalFound += searchResult.results.length
        console.log(`Found ${searchResult.results.length} results`)

        for (const result of searchResult.results) {
          // Skip if we already processed this URL
          if (processedUrls.has(result.url)) {
            console.log(`⏭️  Skipping duplicate: ${result.url}`)
            continue
          }

          try {
            // Add rate limiting
            await delay(RATE_LIMIT_DELAY)

            const contentResult = await safeExaRequest(
              () => exa.getContents([result.id]),
              3,
              `comprehensive content for ${result.url}`
            )

            if (contentResult?.results && contentResult.results.length > 0) {
              const content = contentResult.results[0]

              // Quality and duplication checks
              if (!isQualityContent(content.text || '', result.title || '')) {
                console.log(`⏭️  Skipping low-quality content: ${result.title} (${content.text?.length || 0} chars)`)
                continue
              }

              const contentHash = getContentHash(content.text || '')
              if (processedContent.has(contentHash)) {
                console.log(`⏭️  Skipping duplicate content: ${result.title}`)
                continue
              }

              const knowledgeItem: AvenKnowledgeItem = {
                id: `aven-comprehensive-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
                title: result.title || 'Untitled',
                content: content.text || 'No content available',
                url: result.url || '',
                category: categorizeContent((result.title || '') + ' ' + (content.text || '')),
              }

              allResults.push(knowledgeItem)
              processedUrls.add(result.url)
              processedContent.add(contentHash)
              totalProcessed++

              console.log(`✅ [${totalProcessed}] Processed: ${result.title} (${content.text?.length || 0} chars)`)

              // Add to knowledge base immediately with retry logic
              const kbResult = await safeExaRequest(
                () => addToKnowledgeBase(knowledgeItem),
                2,
                `adding ${knowledgeItem.id} to knowledge base`
              )

              if (kbResult !== null) {
                console.log(`📚 Added to knowledge base: ${knowledgeItem.id}`)
              } else {
                console.error(`❌ Failed to add to knowledge base: ${knowledgeItem.id}`)
              }
            }
          } catch (contentError) {
            console.error(`❌ Error getting content for ${result.url}:`, contentError)
            continue
          }
        }

        // Add delay between strategies
        await delay(RATE_LIMIT_DELAY * 2)

      } catch (error) {
        console.error(`❌ Error in search strategy "${strategy.query}":`, error)
        continue
      }
    }

    console.log(`\n🎉 Comprehensive search completed!`)
    console.log(`📊 Total URLs found: ${totalFound}`)
    console.log(`📚 Unique pages processed: ${totalProcessed}`)
    console.log(`🔗 Unique URLs in memory: ${processedUrls.size}`)

    return allResults
  } catch (error) {
    console.error('❌ Error in comprehensive site search:', error)
    throw error
  }
}

export async function updateKnowledgeBase() {
  try {
    await scrapeAvenData()
    console.log('Knowledge base updated successfully')
  } catch (error) {
    console.error('Error updating knowledge base:', error)
    throw error
  }
}

export async function updateKnowledgeBaseComprehensive() {
  try {
    // First run the targeted search
    await scrapeAvenData()

    // Then run the comprehensive search
    await comprehensiveSiteSearch()

    console.log('Comprehensive knowledge base update completed successfully')
  } catch (error) {
    console.error('Error updating knowledge base comprehensively:', error)
    throw error
  }
}
