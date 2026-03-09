import { afterEach, expect, test } from 'vitest';
import { getConfiguredOpenAIModel, getSelectedProvider } from './summarizer';

const ORIGINAL_ENV = {
  AI_PROVIDER: process.env.AI_PROVIDER,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
};

afterEach(() => {
  process.env.AI_PROVIDER = ORIGINAL_ENV.AI_PROVIDER;
  process.env.OPENAI_API_KEY = ORIGINAL_ENV.OPENAI_API_KEY;
  process.env.GEMINI_API_KEY = ORIGINAL_ENV.GEMINI_API_KEY;
  process.env.OPENAI_MODEL = ORIGINAL_ENV.OPENAI_MODEL;
});

test('getConfiguredOpenAIModel defaults to gpt-5-mini', () => {
  delete process.env.OPENAI_MODEL;

  expect(getConfiguredOpenAIModel()).toBe('gpt-5-mini');
});

test('getConfiguredOpenAIModel trims configured model names', () => {
  process.env.OPENAI_MODEL = '  gpt-5-mini  ';

  expect(getConfiguredOpenAIModel()).toBe('gpt-5-mini');
});

test('getConfiguredOpenAIModel falls back when env is blank', () => {
  process.env.OPENAI_MODEL = '   ';

  expect(getConfiguredOpenAIModel()).toBe('gpt-5-mini');
});

test('getSelectedProvider honors explicit openai selection when key is present', () => {
  process.env.AI_PROVIDER = 'openai';
  process.env.OPENAI_API_KEY = 'test-openai-key';
  delete process.env.GEMINI_API_KEY;

  expect(getSelectedProvider()).toMatchObject({
    provider: 'openai',
    configuredProvider: 'openai',
    openaiKeyPresent: true,
    geminiKeyPresent: false,
  });
});