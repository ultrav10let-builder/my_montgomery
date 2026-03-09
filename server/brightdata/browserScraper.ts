import { chromium, Browser } from 'playwright';

/** Headline/link text → URL for matching Bright Data headlines to gov pages */
export interface HeadlineLink {
  headline: string;
  url: string;
}

export interface ScrapedResult {
  url: string;
  finalUrl: string;
  title: string;
  text: string;
  /** Raw HTML for date parsing (meta tags, JSON-LD, time elements) */
  html?: string;
  /** Links extracted from page (headline/anchor text → gov URL) for headline→URL mapping */
  headlineLinks?: HeadlineLink[];
  extractedAt: string;
}

const BROWSER_WSS = process.env.BRIGHTDATA_BROWSER_WSS;
const GOTO_TIMEOUT = 2 * 60 * 1000; // 2 min (Bright Data recommendation)

export async function scrapeUrl(url: string): Promise<ScrapedResult> {
  if (!BROWSER_WSS) {
    throw new Error('BRIGHTDATA_BROWSER_WSS is not configured. Add it to .env');
  }

  let browser: Browser | null = null;
  try {
    console.log(`[Bright Data] Connecting for: ${url}`);
    browser = await chromium.connectOverCDP(BROWSER_WSS);
    const page = await browser.newPage();

    page.setDefaultTimeout(GOTO_TIMEOUT);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: GOTO_TIMEOUT });

    const title = await page.title();
    const finalUrl = page.url();

    const text = await page.evaluate(() => {
      const elementsToRemove = ['script', 'style', 'nav', 'footer', 'header', 'aside'];
      elementsToRemove.forEach((tag) => {
        document.querySelectorAll(tag).forEach((el) => el.remove());
      });
      return document.body?.innerText?.trim() ?? '';
    });

    const html = await page.content();

    const headlineLinks = await page.evaluate((baseOrigin: string) => {
      const links: { headline: string; url: string }[] = [];
      const seen = new Set<string>();
      document.querySelectorAll('a[href]').forEach((a) => {
        const href = (a.getAttribute('href') || '').trim();
        const text = (a.textContent || '').trim().replace(/\s+/g, ' ');
        if (!text || text.length < 4 || text.length > 180) return;
        let url = href;
        if (href.startsWith('/')) url = baseOrigin + href;
        if (!url.startsWith('http') || !url.includes('montgomeryal.gov')) return;
        const key = `${text.toLowerCase()}|${url}`;
        if (seen.has(key)) return;
        seen.add(key);
        links.push({ headline: text, url });
      });
      return links;
    }, new URL(finalUrl).origin);

    console.log(`[Bright Data] Scraped: ${title} (${url}) [${headlineLinks.length} links]`);

    return {
      url,
      finalUrl,
      title,
      text: text.substring(0, 10000),
      html: html.substring(0, 200000),
      headlineLinks,
      extractedAt: new Date().toISOString(),
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Bright Data] Failed ${url}:`, msg);
    throw error;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.warn('[Bright Data] Browser close error:', e);
      }
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
