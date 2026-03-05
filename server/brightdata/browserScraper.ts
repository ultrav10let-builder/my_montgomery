import { chromium, Browser, Page } from 'playwright';

export interface ScrapedResult {
  url: string;
  finalUrl: string;
  title: string;
  text: string;
  extractedAt: string;
}

const BROWSER_WSS = process.env.BRIGHTDATA_BROWSER_WSS;

export async function scrapeUrl(url: string): Promise<ScrapedResult> {
  if (!BROWSER_WSS) {
    throw new Error('BRIGHTDATA_BROWSER_WSS is not configured');
  }

  let browser: Browser | null = null;
  try {
    console.log(`Connecting to Bright Data Browser for: ${url}`);
    browser = await chromium.connectOverCDP(BROWSER_WSS);
    const context = await browser.newContext();
    const page = await context.newPage();

    // Set a reasonable timeout
    page.setDefaultTimeout(30000);

    await page.goto(url, { waitUntil: 'domcontentloaded' });

    const title = await page.title();
    const finalUrl = page.url();
    
    // Extract text content - focus on main content if possible
    const text = await page.evaluate(() => {
      // Remove scripts, styles, and other non-content elements
      const elementsToRemove = ['script', 'style', 'nav', 'footer', 'header', 'aside'];
      elementsToRemove.forEach(tag => {
        const els = document.querySelectorAll(tag);
        els.forEach(el => el.remove());
      });
      return document.body.innerText.trim();
    });

    return {
      url,
      finalUrl,
      title,
      text: text.substring(0, 10000), // Limit text size for AI processing
      extractedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Scrape multiple URLs with limited concurrency
 */
export async function scrapeUrls(urls: string[], concurrency: number = 2): Promise<ScrapedResult[]> {
  const results: ScrapedResult[] = [];
  const queue = [...urls];

  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift();
      if (!url) break;
      try {
        const result = await scrapeUrl(url);
        results.push(result);
      } catch (err) {
        console.error(`Failed to scrape ${url}:`, err);
      }
    }
  }

  // Start workers
  const workers = Array(Math.min(concurrency, urls.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);
  return results;
}
