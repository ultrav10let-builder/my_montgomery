import { expect, test } from 'vitest';
import {
  deriveSignalLifecycle,
  deriveTrafficFeedLifecycle,
  isSignalActive,
  isSignalResolved,
  isTrafficFeedActive,
} from './liveFilter';

const NOW = new Date('2026-03-09T12:00:00.000Z');

test('treats stale traffic incidents as inactive in live mode', () => {
  expect(
    isSignalActive(
      {
        category: 'Traffic',
        event_at_utc: '2026-03-09T03:00:00.000Z',
        raw_json: JSON.stringify({ description: 'Crash on I-85 near Montgomery.' }),
      },
      NOW,
    ),
  ).toBe(false);
});

test('keeps road closures active longer than short-lived traffic incidents', () => {
  const lifecycle = deriveSignalLifecycle(
    {
      category: 'Road Closure',
      event_at_utc: '2026-03-06T12:00:00.000Z',
      raw_json: JSON.stringify({ description: 'Construction continues along Eastern Blvd.' }),
    },
    NOW,
  );

  expect(lifecycle.policyKey).toBe('traffic-roadwork');
  expect(lifecycle.isActive).toBe(true);
});

test('honors explicit end dates for scheduled events', () => {
  expect(
    isSignalActive(
      {
        category: 'Civic',
        event_at_utc: '2026-03-08T16:00:00.000Z',
        raw_json: JSON.stringify({
          attributes: {
            START_DATE: '2026-03-08T16:00:00.000Z',
            END_DATE: '2026-03-09T10:00:00.000Z',
            TITLE: 'Council meeting',
          },
        }),
      },
      NOW,
    ),
  ).toBe(false);
});

test('resolved status still overrides category timing', () => {
  const rawJson = JSON.stringify({ attributes: { STATUS: 'Closed', CLOSED_AT: '2026-03-09T09:00:00.000Z' } });

  expect(isSignalResolved(rawJson)).toBe(true);
  expect(
    isSignalActive(
      {
        category: 'Infrastructure',
        event_at_utc: '2026-03-08T12:00:00.000Z',
        raw_json: rawJson,
      },
      NOW,
    ),
  ).toBe(false);
});

test('traffic feed lifecycle keeps construction active for multiple days', () => {
  const lifecycle = deriveTrafficFeedLifecycle(
    {
      description: 'Construction on I-85 near Montgomery continues with lane closure by Eastern Blvd.',
      road: 'I-85',
      source_label: 'ALDOT 511',
      ingested_at_utc: '2026-03-05T12:00:00.000Z',
      created_at_utc: '2026-03-05T12:00:00.000Z',
    },
    NOW,
  );

  expect(lifecycle.policyKey).toBe('traffic-roadwork');
  expect(lifecycle.isActive).toBe(true);
});

test('traffic feed lifecycle drops stale crashes after the short incident window', () => {
  expect(
    isTrafficFeedActive(
      {
        description: 'Crash on I-85 near Montgomery causing delays.',
        road: 'I-85',
        source_label: 'ALDOT 511',
        ingested_at_utc: '2026-03-09T02:00:00.000Z',
        created_at_utc: '2026-03-09T02:00:00.000Z',
      },
      NOW,
    ),
  ).toBe(false);
});