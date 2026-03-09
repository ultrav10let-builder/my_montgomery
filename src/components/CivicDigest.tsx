import React, { useState, useEffect, useMemo } from 'react';
import { FileText, ChevronRight, ChevronLeft, RefreshCw, ExternalLink, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DigestResponse, DigestEntry } from '../types';
import { safeFormat } from '../utils/dateUtils';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DIGEST_CATEGORIES = [
  'All',
  'Traffic',
  'Parks',
  'Civic',
  'Infrastructure',
  'Sanitation',
  'Public Safety',
  'Planning',
] as const;

const SLIDE_INTERVAL_MS = 6000;

/** Infer category from source/title when item has no category (legacy data). */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Traffic: ['road', 'street', 'closure', 'detour', 'public works', 'highway', 'traffic'],
  Parks: ['park', 'parks', 'recreation', 'facility', 'pool', 'event'],
  Civic: ['council', 'meeting', 'ordinance', 'hearing', 'civic', 'public'],
  Infrastructure: ['construction', 'permit', 'infrastructure', 'capital project', 'roadway'],
  Sanitation: ['sanitation', 'trash', 'recycling', 'schedule', 'citation', 'bulk'],
  'Public Safety': ['public safety', 'police', 'fire', 'emergency'],
  Planning: ['zoning', 'planning', 'board of adjustment', 'land use', 'rezoning'],
};

function inferCategory(source: string, title: string): string {
  const text = `${(source || '')} ${(title || '')}`.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => text.includes(k))) return cat;
  }
  return 'Civic';
}

function resolveCategory(entry: DigestEntry): string {
  return (entry.category || '').trim() || inferCategory(entry.source || '', entry.title || '');
}

function buildLocationLabel(entry: DigestEntry): string | null {
  if (entry.location_text?.trim()) return entry.location_text.trim();
  const parts = [entry.neighborhood, entry.district].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

function badgeTone(label: string): string {
  switch (label.toLowerCase()) {
    case 'traffic':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'public safety':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'sanitation':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'planning':
      return 'bg-violet-50 text-violet-700 border-violet-200';
    case 'parks':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'infrastructure':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

interface CivicDigestProps {
  digest: DigestResponse | null;
  loading: boolean;
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
  onRefresh?: (token: string) => void;
}

export function CivicDigest({ digest, loading, selectedCategory: selectedCategoryProp, onCategoryChange, onRefresh }: CivicDigestProps) {
  const [internalCategory, setInternalCategory] = useState('All');
  const selectedCategory = selectedCategoryProp ?? internalCategory;
  const setCategory = onCategoryChange ?? setInternalCategory;
  const [slideIndex, setSlideIndex] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);

  const handleAdminRefresh = () => {
    if (!onRefresh) return;
    const token = localStorage.getItem('admin_token');
    if (!token) {
      const input = prompt('Enter Admin Token:');
      if (input) {
        localStorage.setItem('admin_token', input);
        onRefresh(input);
      }
    } else {
      onRefresh(token);
    }
  };

  const items = digest?.items ?? [];
  const sources = digest?.sources ?? [];
  /** Only external gov URLs – never localhost or internal. */
  const isExternalGovUrl = (u: string) =>
    u && u.startsWith('https://') && (u.includes('montgomeryal.gov') || u.includes('.gov')) &&
    !u.includes('localhost') && !u.includes('127.0.0.1');
  const sourceUrls = sources
    .map((s) => (typeof s === 'string' ? s : (s as { url?: string }).url))
    .filter((u): u is string => Boolean(u) && isExternalGovUrl(u));

  const filteredItems = useMemo(
    () =>
      selectedCategory === 'All'
        ? items
        : items.filter((i) => {
            const resolved = resolveCategory(i);
            return resolved.toLowerCase() === selectedCategory.toLowerCase();
          }),
    [selectedCategory, items]
  );

  const hasItems = filteredItems.length > 0;
  const currentItem = hasItems ? filteredItems[slideIndex % filteredItems.length] : null;
  const currentCategory = currentItem ? resolveCategory(currentItem) : null;
  const currentLocation = currentItem ? buildLocationLabel(currentItem) : null;

  useEffect(() => {
    setSlideIndex(0);
  }, [selectedCategory]);

  useEffect(() => {
    if (!autoRotate || !hasItems || filteredItems.length <= 1) return;
    const t = setInterval(() => setSlideIndex((i) => i + 1), SLIDE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [autoRotate, hasItems, filteredItems.length, selectedCategory]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-civic-red" />
          <div>
            <h2 className="font-semibold">Today in Montgomery</h2>
            <p className="text-[10px] text-slate-500 font-medium">Road closures · Council · Zoning · City updates</p>
          </div>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={handleAdminRefresh}
            className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-400 hover:text-civic-blue focus-visible:ring-2 focus-visible:ring-civic-blue focus-visible:ring-offset-2"
            title="Refresh Digest (Admin)"
            aria-label="Refresh digest (admin)"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} aria-hidden />
          </button>
        )}
      </div>

      {digest && (digest.metadata?.event_at || sourceUrls.length > 0) && (
        <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
            Last Updated: {safeFormat(digest.metadata?.event_at, 'MMM d, h:mm a')}
          </span>
          <div className="flex gap-2 flex-wrap">
            {sourceUrls.slice(0, 4).map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-civic-blue hover:underline flex items-center gap-0.5"
              >
                Source {i + 1} <ExternalLink className="w-2 h-2" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Category tabs – always show all */}
      {items.length > 0 && (
        <div className="px-3 py-1.5 border-b border-slate-100 flex gap-1 flex-wrap overflow-x-auto" role="group" aria-label="Filter digest by category">
          {DIGEST_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              aria-pressed={selectedCategory === cat}
              aria-label={cat === 'All' ? 'Show all topics' : `Filter by ${cat}`}
              className={cn(
                'px-2.5 py-1 rounded-full text-[10px] font-medium transition-all focus-visible:ring-2 focus-visible:ring-civic-blue focus-visible:ring-offset-2',
                selectedCategory === cat ? 'bg-civic-blue text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Slideshow content */}
      <div className="overflow-hidden p-3 min-h-[120px]">
        {loading && items.length === 0 ? (
          <div className="space-y-2">
            {Array(3)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="animate-pulse space-y-2">
                  <div className="h-4 bg-slate-100 rounded w-3/4" />
                  <div className="h-3 bg-slate-50 rounded w-full" />
                  <div className="h-3 bg-slate-50 rounded w-1/2" />
                </div>
              ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-sm text-slate-500 py-4 text-center flex-1">
            {digest?.message ?? 'No digest for today.'}
            {onRefresh && (
              <p className="mt-2 text-xs">
                <button type="button" onClick={handleAdminRefresh} className="text-civic-blue hover:underline font-medium focus-visible:ring-2 focus-visible:ring-civic-blue focus-visible:ring-offset-2 rounded-sm">
                  Click Refresh (Admin)
                </button>{' '}
                to fetch live civic news.
              </p>
            )}
          </div>
        ) : !hasItems ? (
          <div className="text-sm text-slate-500 py-6 text-center flex flex-col gap-2">
            <span>No new updates for {format(new Date(), 'MMMM d, yyyy')}</span>
            <span className="text-[10px] text-slate-600">Topic: {selectedCategory}</span>
          </div>
        ) : (
          <>
            {selectedCategory !== 'All' && (
              <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Topic: {selectedCategory}
              </p>
            )}
            <div className="overflow-y-auto min-h-[80px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={slideIndex}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="block hover:bg-slate-50/70 -m-2 p-3 rounded-xl border border-slate-200/80 bg-white/80 shadow-md transition-colors">
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-civic-red opacity-70">
                        {currentItem?.source}
                      </span>
                      {currentItem?.url && isExternalGovUrl(currentItem.url) ? (
                        <a
                          href={currentItem.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-civic-blue hover:underline flex items-center gap-0.5"
                        >
                          View source <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No Source URL Provided</span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">{currentItem?.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {currentCategory && (
                        <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', badgeTone(currentCategory))}>
                          {currentCategory}
                        </span>
                      )}
                      {currentItem?.district && (
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">
                          {currentItem.district}
                        </span>
                      )}
                      {currentItem?.neighborhood && (
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">
                          {currentItem.neighborhood}
                        </span>
                      )}
                    </div>
                    {currentLocation && (
                      <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-slate-500">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        <span>{currentLocation}</span>
                      </p>
                    )}
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {currentItem?.content ?? currentItem?.summary ?? 'N/A'}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Slide controls */}
            {filteredItems.length > 1 && (
              <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setAutoRotate(false);
                    setSlideIndex((i) => Math.max(0, i - 1));
                  }}
                  className="p-1.5 rounded hover:bg-slate-100 text-slate-500 focus-visible:ring-2 focus-visible:ring-civic-blue focus-visible:ring-offset-2"
                  aria-label="Previous digest item"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden />
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">
                    {1 + (slideIndex % filteredItems.length)} / {filteredItems.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAutoRotate((value) => !value)}
                    className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-civic-blue focus-visible:ring-offset-2"
                    aria-label={autoRotate ? 'Pause digest rotation' : 'Resume digest rotation'}
                  >
                    {autoRotate ? 'Pause rotation' : 'Resume rotation'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAutoRotate(false);
                    setSlideIndex((i) => i + 1);
                  }}
                  className="p-1.5 rounded hover:bg-slate-100 text-slate-500 focus-visible:ring-2 focus-visible:ring-civic-blue focus-visible:ring-offset-2"
                  aria-label="Next digest item"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
