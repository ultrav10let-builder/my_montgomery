/**
 * AI summarization - supports OpenAI or Google Gemini.
 * Prefers OPENAI_API_KEY if set, otherwise uses GEMINI_API_KEY.
 *
 * Mode determination (server-side only, keys never exposed):
 * - Live mode: OPENAI_API_KEY or GEMINI_API_KEY present and valid in process.env
 * - Fallback mode: Key missing or invalid → /api/ai/summarize returns user-friendly message
 */

const SYSTEM_PROMPT =
  'You are a civic data analyst for the city of Montgomery. Provide concise, professional insights.';

const MAX_TOKENS_INSIGHT = 200; // ~120 words; insight JSON only

const DEFAULT_OPENAI_MODEL = 'gpt-5-mini';

export function getConfiguredOpenAIModel(): string {
  const configured = process.env.OPENAI_MODEL?.trim();
  return configured || DEFAULT_OPENAI_MODEL;
}

function normalizePrompt(prompt: string, jsonMode: boolean): string {
  if (!jsonMode) return prompt;
  return `${prompt}\n\nReturn only valid JSON. Do not include markdown fences or extra commentary.`;
}

async function summarizeWithOpenAI(prompt: string, jsonMode = false, maxTokens?: number): Promise<string> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: getConfiguredOpenAIModel(),
    instructions: SYSTEM_PROMPT,
    input: normalizePrompt(prompt, jsonMode),
    max_output_tokens: maxTokens ?? (jsonMode ? 2000 : 500),
  });
  const text = response.output_text?.trim();
  if (!text) throw new Error('OpenAI returned empty response');
  return text;
}

async function summarizeWithGemini(prompt: string, jsonMode = false, maxTokens?: number): Promise<string> {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const tokenLimit = maxTokens ?? (jsonMode ? 2000 : 500);
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash',
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: tokenLimit,
      ...(jsonMode && { responseMimeType: 'application/json' }),
    },
  });
  const text = response.text?.trim();
  if (!text) throw new Error('Gemini returned empty response');
  return text;
}

async function callAI(prompt: string, jsonMode: boolean, maxTokens?: number): Promise<string> {
  if (process.env.OPENAI_API_KEY) {
    return summarizeWithOpenAI(prompt, jsonMode, maxTokens);
  }
  if (process.env.GEMINI_API_KEY) {
    return summarizeWithGemini(prompt, jsonMode, maxTokens);
  }
  throw new Error('No AI provider configured. Set OPENAI_API_KEY or GEMINI_API_KEY in .env');
}

/** Returns which AI provider is active. Keys are read from process.env only; never exposed. */
export function getAIProviderStatus(): { provider: 'openai' | 'gemini' | 'none'; keyPresent: boolean } {
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY?.trim());
  const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());
  if (hasOpenAI) return { provider: 'openai', keyPresent: true };
  if (hasGemini) return { provider: 'gemini', keyPresent: true };
  return { provider: 'none', keyPresent: false };
}

export type SelectedProvider = 'openai' | 'gemini' | 'fallback';

/**
 * Get the selected AI provider based on AI_PROVIDER env and keys.
 * - AI_PROVIDER=openai: use OpenAI only; fallback if no key
 * - AI_PROVIDER=gemini: use Gemini only; fallback if no key
 * - AI_PROVIDER=auto or unset: prefer OpenAI, then Gemini, then fallback
 */
export function getSelectedProvider(): {
  provider: SelectedProvider;
  openaiKeyPresent: boolean;
  geminiKeyPresent: boolean;
  configuredProvider: string;
} {
  const openaiKeyPresent = Boolean(process.env.OPENAI_API_KEY?.trim());
  const geminiKeyPresent = Boolean(process.env.GEMINI_API_KEY?.trim());
  const override = (process.env.AI_PROVIDER || 'auto').trim().toLowerCase();
  let provider: SelectedProvider = 'fallback';

  if (override === 'openai') {
    provider = openaiKeyPresent ? 'openai' : 'fallback';
  } else if (override === 'gemini') {
    provider = geminiKeyPresent ? 'gemini' : 'fallback';
  } else {
    provider = openaiKeyPresent ? 'openai' : geminiKeyPresent ? 'gemini' : 'fallback';
  }

  return {
    provider,
    openaiKeyPresent,
    geminiKeyPresent,
    configuredProvider: override,
  };
}

/** Call OpenAI or Gemini explicitly. Throws if provider unavailable. */
export async function generateStructuredJsonWithProvider<T = unknown>(
  prompt: string,
  provider: 'openai' | 'gemini',
  options?: { maxTokens?: number }
): Promise<T> {
  const maxTokens = options?.maxTokens ?? 200;
  let text: string;
  if (provider === 'openai') {
    text = await summarizeWithOpenAI(prompt, true, maxTokens);
  } else {
    text = await summarizeWithGemini(prompt, true, maxTokens);
  }
  return JSON.parse(text) as T;
}

export async function generateSummary(prompt: string): Promise<string> {
  return callAI(prompt, false);
}

export async function generateStructuredJson<T = unknown>(
  prompt: string,
  options?: { maxTokens?: number }
): Promise<T> {
  const maxTokens = options?.maxTokens;
  const text = await callAI(prompt, true, maxTokens);
  return JSON.parse(text) as T;
}
