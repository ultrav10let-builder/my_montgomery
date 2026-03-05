import { scrapeUrls, ScrapedResult } from '../brightdata/browserScraper';
import { GoogleGenAI } from '@google/genai';
import db from '../storage/db';
import fs from 'fs';
import path from 'path';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const WHITELIST_URLS = [
  "https://www.montgomeryal.gov/news",
  "https://www.montgomeryal.gov/city-council",
  "https://www.montgomeryal.gov/departments/planning",
  "https://www.montgomeryal.gov/departments/parks-recreation",
  "https://www.montgomeryal.gov/departments/public-safety"
];

export interface DigestItem {
  title: string;
  summary: string;
  source: string;
  url: string;
}

export interface FullDigest {
  date: string;
  items: DigestItem[];
  sources: string[];
  createdAt: string;
}

export async function generateDailyDigest(): Promise<FullDigest> {
  console.log("Starting daily digest generation...");

  // 1. Scrape URLs
  const scrapedResults = await scrapeUrls(WHITELIST_URLS, 2);
  
  if (scrapedResults.length === 0) {
    throw new Error("No data scraped from whitelist URLs");
  }

  // 2. AI Summarization
  const prompt = `
    You are a civic data analyst for the City of Montgomery.
    I will provide you with scraped text from several city departments and news pages.
    Your task is to create a "Civic Digest" for today.
    
    Rules:
    - Identify 5-10 key bullet points across all sources.
    - Each item must have a clear title, a concise 1-2 sentence summary, and the source department.
    - Focus on news, upcoming meetings, policy changes, or community events.
    - Format as a JSON array of objects: { "title": "...", "summary": "...", "source": "...", "url": "..." }
    
    Scraped Data:
    ${scrapedResults.map(r => `SOURCE: ${r.title} (${r.url})\nCONTENT: ${r.text.substring(0, 2000)}`).join('\n\n---\n\n')}
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json"
    }
  });

  const items: DigestItem[] = JSON.parse(response.text);
  
  const digest: FullDigest = {
    date: new Date().toISOString().split('T')[0],
    items,
    sources: scrapedResults.map(r => r.url),
    createdAt: new Date().toISOString()
  };

  // 3. Store in SQLite
  db.prepare(`
    INSERT INTO digests (date, items_json, sources_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(digest.date, JSON.stringify(digest.items), JSON.stringify(digest.sources), digest.createdAt);

  // 4. Write to file fallback
  const dir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'digest_today.json'), JSON.stringify(digest, null, 2));

  console.log("Daily digest generation complete.");
  return digest;
}

export function getLatestDigest(): FullDigest | null {
  try {
    const row = db.prepare('SELECT * FROM digests ORDER BY created_at DESC LIMIT 1').get() as {
      date: string;
      items_json: string;
      sources_json: string;
      created_at: string;
    } | undefined;
    
    if (row) {
      return {
        date: row.date,
        items: JSON.parse(row.items_json),
        sources: JSON.parse(row.sources_json),
        createdAt: row.created_at
      };
    }
    
    // Fallback to file
    const filePath = path.join(process.cwd(), 'data', 'digest_today.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (error) {
    console.error("Error fetching latest digest:", error);
  }
  return null;
}
