/**
 * Montgomery-only content filter.
 * Phase 1: Restrict digest/traffic to Montgomery, Alabama relevant items.
 * Include: Montgomery, Montgomery roads, districts, landmarks.
 * Exclude: Items clearly tied to Birmingham, Mobile, Huntsville, Auburn, etc.
 */

/** Patterns indicating Montgomery, Alabama relevance. At least one should match for include. */
const MONTGOMERY_INCLUDE_PATTERNS = [
  /\bMontgomery\b/i,
  /\bMalfunction\s*Junction\b/i,
  /\bCapital\s*City\b/i,
  /\b(Eastern\s*Blvd|Atlanta\s*Hwy|Bell\s*Rd|Madison\s*Ave|Ann\s*St|Dexter\s*Ave|Vaughn\s*Rd|Fairview\s*Ave)\b/i,
  /\bMontgomery\s+(County|area|metro)\b/i,
  /\b(I[- ]?65|I[- ]?85|I[- ]?459)\s+.*(Montgomery|Malfunction|Eastern|Atlanta|Capital\s*City)\b/i,
  /\b(Montgomery|Malfunction|Eastern|Atlanta|Capital\s*City).*(I[- ]?65|I[- ]?85|I[- ]?459)\b/i,
  /\bDistrict\s*[1-9]\s+.*Montgomery\b/i,
  /\bMontgomery.*District\s*[1-9]\b/i,
];

/** Patterns indicating other Alabama cities – exclude when matched. */
const NON_MONTGOMERY_EXCLUDE_PATTERNS = [
  /\bBirmingham\b/i,
  /\bHoover\b/i,
  /\bHuntsville\b/i,
  /\bMadison\s+(County|,?\s*AL)\b/i,
  /\bMobile\b/i,
  /\bDaphne\b/i,
  /\bFairhope\b/i,
  /\bAuburn\b/i,
  /\bOpelika\b/i,
  /\bTuscaloosa\b/i,
  /\bNorthport\b/i,
  /\bDecatur\b/i,
  /\bFlorence\b/i,
  /\bGadsden\b/i,
  /\bDothan\b/i,
  /\bAnniston\b/i,
  /\bCullman\b/i,
  /\bVestavia\b/i,
  /\bHomewood\b/i,
];

/**
 * Check if text is Montgomery-relevant.
 * Returns true only if at least one include pattern matches AND no exclude pattern matches.
 */
export function isMontgomeryRelevant(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  for (const p of NON_MONTGOMERY_EXCLUDE_PATTERNS) {
    if (p.test(t)) return false;
  }
  for (const p of MONTGOMERY_INCLUDE_PATTERNS) {
    if (p.test(t)) return true;
  }
  return false;
}

/**
 * Check if text is clearly non-Montgomery (exclude).
 */
export function isNonMontgomery(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  for (const p of NON_MONTGOMERY_EXCLUDE_PATTERNS) {
    if (p.test(t)) return true;
  }
  return false;
}

/**
 * Assume Montgomery when source is montgomeryal.gov (all content is city official).
 * Exclude only if item explicitly mentions another AL city.
 */
export function isMontgomeryRelevantFromGovSource(text: string): boolean {
  if (isNonMontgomery(text)) return false;
  return true;
}
