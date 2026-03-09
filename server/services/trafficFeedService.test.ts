import { beforeEach, expect, test, vi } from 'vitest';
import type { ScrapedResult } from '../brightdata/browserScraper';

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
}));

vi.mock('../storage/db', () => ({
  default: {
    prepare: mocks.prepare,
    transaction: (fn: (...args: unknown[]) => unknown) => fn,
  },
}));

import {
  areTrafficItemsLikelyDuplicate,
  dedupeTrafficFeedItems,
  getLatestTrafficFeeds,
  isMontgomeryTrafficItem,
  parseIncidentsFromHtml,
} from './trafficFeedService';

function makeScrapedResult(overrides: Partial<ScrapedResult>): ScrapedResult {
  return {
    url: 'https://511.alabama.gov/',
    finalUrl: 'https://511.alabama.gov/',
    title: 'ALDOT 511',
    text: '',
    extractedAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.useRealTimers();
  mocks.prepare.mockImplementation((sql: string) => {
    if (sql.includes('SELECT * FROM traffic_feeds')) {
      return { all: mocks.all };
    }
    return { all: mocks.all, run: mocks.run };
  });
  mocks.all.mockReset();
  mocks.run.mockReset();
});

test('rejects clearly non-Montgomery statewide incidents', () => {
  expect(
    isMontgomeryTrafficItem({
      source_url: 'https://511.alabama.gov/',
      source_label: 'ALDOT 511',
      description: 'Crash on I-565 in Huntsville causing delays near Research Park Blvd.',
      road: 'I-565',
    })
  ).toBe(false);
});

test('requires explicit Montgomery evidence for statewide 511 traffic items', () => {
  expect(
    isMontgomeryTrafficItem({
      source_url: 'https://511.alabama.gov/',
      source_label: 'ALDOT 511',
      description: 'Crash on I-65 causing delays in the northbound lanes.',
      road: 'I-65',
    })
  ).toBe(false);

  expect(
    isMontgomeryTrafficItem({
      source_url: 'https://511.alabama.gov/',
      source_label: 'ALDOT 511',
      description: 'Crash on I-85 near Montgomery causing delays by Eastern Blvd.',
      road: 'I-85',
    })
  ).toBe(true);
});

test('does not create generic fallback traffic items from broad statewide pages', () => {
  const items = parseIncidentsFromHtml(
    makeScrapedResult({
      text: 'Live cameras and statewide travel resources are available across Alabama. Use the map to inspect traffic conditions. '.repeat(3),
    })
  );

  expect(items).toEqual([]);
});

test('detects likely duplicate local-news blurbs for the same fatal Montgomery crash cluster', () => {
  const a = {
    id: 'a',
    source_url: 'https://www.wsfa.com/news/story-a',
    source_label: 'News',
    description: 'a man was killed saturday morning in a single-vehicle crash, according to the montgomery police department',
    ingested_at_utc: '2026-03-09T12:00:00.000Z',
    created_at_utc: '2026-03-09T12:00:00.000Z',
  };
  const b = {
    id: 'b',
    source_url: 'https://www.wsfa.com/news/story-b',
    source_label: 'News',
    description: 'man killed in early-morning crash in montgomery',
    ingested_at_utc: '2026-03-09T11:55:00.000Z',
    created_at_utc: '2026-03-09T11:55:00.000Z',
  };
  const c = {
    id: 'c',
    source_url: 'https://www.waka.com/news/story-c',
    source_label: 'News - WAKA 8',
    description: 'man dead in montgomery crash',
    ingested_at_utc: '2026-03-09T11:54:00.000Z',
    created_at_utc: '2026-03-09T11:54:00.000Z',
  };

  expect(areTrafficItemsLikelyDuplicate(a, b)).toBe(true);
  expect(areTrafficItemsLikelyDuplicate(b, c)).toBe(true);
  const [merged] = dedupeTrafficFeedItems([a, b, c]);

  expect(merged.id).toBe('a');
  expect(merged.dedupe_confidence).toBeGreaterThan(0.6);
  expect(merged.dedupe_reason).toBe('same-city-fatal-crash');
  expect(merged.merged_report_count).toBe(3);
  expect(merged.merged_source_count).toBe(3);
  expect(merged.suppressed_duplicate_count).toBe(2);
});

test('does not merge distinct incidents on different roads', () => {
  const items = dedupeTrafficFeedItems([
    {
      id: 'i85-crash',
      source_url: 'https://511.alabama.gov/',
      source_label: 'ALDOT 511',
      road: 'I-85',
      description: 'Crash on I-85 near Montgomery causing delays by Eastern Blvd.',
      ingested_at_utc: '2026-03-09T12:00:00.000Z',
      created_at_utc: '2026-03-09T12:00:00.000Z',
    },
    {
      id: 'i65-construction',
      source_url: 'https://www.wsfa.com/news/',
      source_label: 'WSFA',
      road: 'I-65',
      description: 'Construction on I-65 near Montgomery continues with lane closure.',
      ingested_at_utc: '2026-03-09T12:02:00.000Z',
      created_at_utc: '2026-03-09T12:02:00.000Z',
    },
  ]);

  expect(items.map((item) => item.id)).toEqual(['i65-construction', 'i85-crash']);
});

test('getLatestTrafficFeeds keeps longer-lived construction items in live mode while dropping stale crashes', () => {
  vi.setSystemTime(new Date('2026-03-09T12:00:00.000Z'));
  mocks.all.mockReturnValue([
    {
      id: 'construction-1',
      source_url: 'https://www.wsfa.com/news/',
      source_label: 'WSFA',
      description: 'Construction on I-85 near Montgomery continues with lane closure by Eastern Blvd.',
      road: 'I-85',
      severity: 'medium',
      ingested_at_utc: '2026-03-05T12:00:00.000Z',
      created_at_utc: '2026-03-05T12:00:00.000Z',
    },
    {
      id: 'crash-1',
      source_url: 'https://511.alabama.gov/',
      source_label: 'ALDOT 511',
      description: 'Crash on I-85 near Montgomery causing delays by Eastern Blvd.',
      road: 'I-85',
      severity: 'high',
      ingested_at_utc: '2026-03-09T03:00:00.000Z',
      created_at_utc: '2026-03-09T03:00:00.000Z',
    },
    {
      id: 'crash-2',
      source_url: 'https://511.alabama.gov/',
      source_label: 'ALDOT 511',
      description: 'Crash on I-85 near Montgomery causing delays by Eastern Blvd.',
      road: 'I-85',
      severity: 'high',
      ingested_at_utc: '2026-03-09T10:30:00.000Z',
      created_at_utc: '2026-03-09T10:30:00.000Z',
    },
    {
      id: 'other-city',
      source_url: 'https://511.alabama.gov/',
      source_label: 'ALDOT 511',
      description: 'Construction on I-565 in Huntsville.',
      road: 'I-565',
      severity: 'medium',
      ingested_at_utc: '2026-03-09T10:00:00.000Z',
      created_at_utc: '2026-03-09T10:00:00.000Z',
    },
  ]);

  expect(getLatestTrafficFeeds(true).map((item) => item.id)).toEqual(['crash-2', 'construction-1']);
});

test('getLatestTrafficFeeds suppresses same-event duplicate rows before returning feeds', () => {
  vi.setSystemTime(new Date('2026-03-09T12:00:00.000Z'));
  mocks.all.mockReturnValue([
    {
      id: 'fatal-1',
      source_url: 'https://www.wsfa.com/news/story-a',
      source_label: 'News',
      description: 'a man was killed saturday morning in a single-vehicle crash, according to the montgomery police department',
      ingested_at_utc: '2026-03-09T12:00:00.000Z',
      created_at_utc: '2026-03-09T12:00:00.000Z',
    },
    {
      id: 'fatal-2',
      source_url: 'https://www.wsfa.com/news/story-b',
      source_label: 'News',
      description: 'man killed in early-morning crash in montgomery',
      ingested_at_utc: '2026-03-09T11:59:00.000Z',
      created_at_utc: '2026-03-09T11:59:00.000Z',
    },
    {
      id: 'fatal-3',
      source_url: 'https://www.waka.com/news/story-c',
      source_label: 'News - WAKA 8',
      description: 'man dead in montgomery crash',
      ingested_at_utc: '2026-03-09T11:58:00.000Z',
      created_at_utc: '2026-03-09T11:58:00.000Z',
    },
  ]);

  const items = getLatestTrafficFeeds(true);
  const [item] = items;

  expect(items).toHaveLength(1);
  expect(item.id).toBe('fatal-1');
  expect(item.dedupe_confidence).toBeGreaterThan(0.6);
  expect(item.dedupe_reason).toBe('same-city-fatal-crash');
  expect(item.merged_report_count).toBe(3);
  expect(item.merged_source_count).toBe(3);
  expect(item.suppressed_duplicate_count).toBe(2);
});