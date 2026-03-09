export type AIInsightMode = 'live' | 'fallback' | 'cached';

export interface AIInsightStatus {
  loading: boolean;
  error: boolean;
  hasContent: boolean;
  mode?: AIInsightMode;
  provider?: string;
}

export type AIInsightStatusTone = 'checking' | 'live' | 'cached' | 'fallback' | 'unavailable';

export function getAIInsightStatusDisplay(status?: AIInsightStatus | null): {
  label: string;
  tone: AIInsightStatusTone;
} {
  if (!status || status.loading) {
    return { label: 'AI: Checking', tone: 'checking' };
  }

  if (status.hasContent) {
    if (status.mode === 'live') {
      if (status.provider === 'openai') return { label: 'AI: Working · OpenAI', tone: 'live' };
      if (status.provider === 'gemini') return { label: 'AI: Working · Gemini', tone: 'live' };
      return { label: 'AI: Working', tone: 'live' };
    }

    if (status.mode === 'cached') {
      if (status.provider === 'cached-openai') return { label: 'AI: Cached · OpenAI', tone: 'cached' };
      if (status.provider === 'cached-gemini') return { label: 'AI: Cached · Gemini', tone: 'cached' };
      return { label: 'AI: Cached · Fallback', tone: 'cached' };
    }

    if (status.mode === 'fallback' || status.provider === 'fallback') {
      return { label: 'AI: Fallback summary', tone: 'fallback' };
    }

    return { label: 'AI: Working', tone: 'live' };
  }

  if (status.error) {
    return { label: 'AI: Unavailable', tone: 'unavailable' };
  }

  return { label: 'AI: Checking', tone: 'checking' };
}