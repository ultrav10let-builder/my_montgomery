import { z } from 'zod';
import { normalizeDistrictParam } from '../services/trendEngine';

export type InsightSpec = '7d' | '30d' | '90d' | { start: string; end: string };

const DATE_YYYY_MM_DD = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

const insightsQuerySchema = z.object({
  window: z.enum(['live', '7d', '30d', '90d']).optional(),
  start: DATE_YYYY_MM_DD.optional(),
  end: DATE_YYYY_MM_DD.optional(),
  district: z.string().optional(),
}).superRefine((data, ctx) => {
  const hasStart = Boolean(data.start);
  const hasEnd = Boolean(data.end);
  if (hasStart !== hasEnd) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide both start and end for a custom insight range',
      path: hasStart ? ['end'] : ['start'],
    });
  }
});

const brightDataHealthQuerySchema = z.object({
  target: z.string().optional().refine((value) => !value || value === 'city', {
    message: 'Use target=city or omit target',
  }),
});

const trafficFeedsQuerySchema = z.object({
  live: z.string().optional().refine((value) => !value || ['1', 'true', '0', 'false'].includes(value), {
    message: 'Use live=true, live=false, live=1, or live=0',
  }),
});

const adminHeaderSchema = z.object({
  'x-admin-token': z.string().min(1),
});

function formatValidationError(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
}

export function parseInsightsQuery(query: unknown): { success: true; spec: InsightSpec; district?: string } | { success: false; error: string } {
  const parsed = insightsQuerySchema.safeParse(query);
  if (!parsed.success) return { success: false, error: formatValidationError(parsed.error) };

  const districtParam = parsed.data.district?.trim();
  const district = districtParam ? normalizeDistrictParam(districtParam) : undefined;
  if (districtParam && !district) return { success: false, error: 'Invalid district. Use 1–9 or District N' };

  if (parsed.data.start && parsed.data.end) {
    if (new Date(parsed.data.start) > new Date(parsed.data.end)) {
      return { success: false, error: 'start must be before or equal to end' };
    }
    return { success: true, spec: { start: parsed.data.start, end: parsed.data.end }, district };
  }

  const window = parsed.data.window === 'live' ? '7d' : (parsed.data.window ?? '7d');
  return { success: true, spec: window, district };
}

export function parseBrightDataHealthQuery(query: unknown): { success: true; useCity: boolean } | { success: false; error: string } {
  const parsed = brightDataHealthQuerySchema.safeParse(query);
  if (!parsed.success) return { success: false, error: formatValidationError(parsed.error) };
  return { success: true, useCity: parsed.data.target === 'city' };
}

export function parseTrafficFeedsQuery(query: unknown): { success: true; live: boolean } | { success: false; error: string } {
  const parsed = trafficFeedsQuerySchema.safeParse(query);
  if (!parsed.success) return { success: false, error: formatValidationError(parsed.error) };
  return { success: true, live: parsed.data.live === '1' || parsed.data.live === 'true' };
}

export function hasValidAdminToken(headers: unknown, expectedToken: string | undefined): boolean {
  if (!expectedToken) return false;
  const parsed = adminHeaderSchema.safeParse(headers);
  return parsed.success && parsed.data['x-admin-token'] === expectedToken;
}