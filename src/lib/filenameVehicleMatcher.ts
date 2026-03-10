/**
 * Deterministic filename-based vehicle matcher.
 * Scores filenames against the fleet inventory to auto-assign or suggest vehicles.
 * Runs client-side, no AI calls — instant results.
 */

import { isFeatureEnabled } from './featureFlags';

export interface MatchableVehicle {
  id: string;
  name: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
}

export type MatchConfidence = 'high' | 'medium' | 'low' | 'none';

export interface FilenameMatchResult {
  vehicleId: string | null;
  confidence: MatchConfidence;
  matchedVehicleName: string | null;
  /** Angle hint extracted from filename, if any */
  angleHint?: string;
}

// Common angle keywords found in filenames
const ANGLE_KEYWORDS: Record<string, string> = {
  front: 'front',
  rear: 'rear',
  back: 'rear',
  left: 'left_side',
  right: 'right_side',
  side: 'left_side',
  interior: 'interior',
  inside: 'interior',
  cabin: 'interior',
  dashboard: 'interior',
  dash: 'interior',
  detail: 'detail',
  wheel: 'detail',
  engine: 'detail',
  trunk: 'detail',
  boot: 'detail',
  hero: 'front_quarter',
  quarter: 'front_quarter',
};

/**
 * Normalize a filename for matching:
 * - Strip extension
 * - Replace separators with spaces
 * - Lowercase
 * - Remove numeric-only tokens and common prefixes (IMG, DSC, etc.)
 */
function normalizeFilename(filename: string): string[] {
  const withoutExt = filename.replace(/\.[^.]+$/, '');
  const normalized = withoutExt
    .replace(/[_\-\.]/g, ' ')
    .toLowerCase()
    .trim();

  const tokens = normalized.split(/\s+/).filter(token => {
    // Remove pure numeric tokens
    if (/^\d+$/.test(token)) return false;
    // Remove common camera prefixes
    if (['img', 'dsc', 'dscn', 'photo', 'pic', 'image', 'screenshot'].includes(token)) return false;
    return token.length > 1;
  });

  return tokens;
}

/**
 * Extract angle hint from filename tokens.
 */
function extractAngleHint(tokens: string[]): string | undefined {
  for (const token of tokens) {
    if (ANGLE_KEYWORDS[token]) {
      return ANGLE_KEYWORDS[token];
    }
  }
  return undefined;
}

/**
 * Score a filename against a single vehicle.
 * Returns a numeric score (0 = no match).
 */
function scoreVehicle(tokens: string[], vehicle: MatchableVehicle): number {
  let score = 0;
  const make = vehicle.make?.toLowerCase();
  const model = vehicle.model?.toLowerCase();
  const color = vehicle.color?.toLowerCase();

  const hasMake = make && tokens.includes(make);
  const hasModel = model && tokens.some(t => model.includes(t) || t.includes(model));
  const hasColor = color && tokens.includes(color);

  if (hasMake && hasModel) {
    score += 10; // Strong match
  } else if (hasMake) {
    score += 4; // Make-only
  } else if (hasModel) {
    score += 3; // Model-only (could be ambiguous)
  }

  if (hasColor) {
    score += 2; // Color boosts confidence
  }

  // Year match
  if (vehicle.year && tokens.includes(String(vehicle.year))) {
    score += 1;
  }

  return score;
}

/**
 * Match a filename to the best vehicle in the fleet.
 * 
 * @param filename - Original filename (e.g., 'Ferrari_F8_front_1.jpg')
 * @param vehicles - Fleet inventory to match against
 * @returns Match result with confidence level
 */
export function matchFilenameToVehicle(
  filename: string,
  vehicles: MatchableVehicle[]
): FilenameMatchResult {
  // Feature flag check
  if (!isFeatureEnabled('filenameAutoMatch')) {
    return { vehicleId: null, confidence: 'none', matchedVehicleName: null };
  }

  if (!vehicles.length) {
    return { vehicleId: null, confidence: 'none', matchedVehicleName: null };
  }

  const tokens = normalizeFilename(filename);
  const angleHint = extractAngleHint(tokens);

  if (tokens.length === 0) {
    return { vehicleId: null, confidence: 'none', matchedVehicleName: null, angleHint };
  }

  // Score all vehicles
  let bestScore = 0;
  let bestVehicle: MatchableVehicle | null = null;
  let secondBestScore = 0;

  for (const vehicle of vehicles) {
    const score = scoreVehicle(tokens, vehicle);
    if (score > bestScore) {
      secondBestScore = bestScore;
      bestScore = score;
      bestVehicle = vehicle;
    } else if (score > secondBestScore) {
      secondBestScore = score;
    }
  }

  if (!bestVehicle || bestScore === 0) {
    return { vehicleId: null, confidence: 'none', matchedVehicleName: null, angleHint };
  }

  // Determine confidence based on score and gap to second-best
  const gap = bestScore - secondBestScore;
  let confidence: MatchConfidence;

  if (bestScore >= 10 && gap >= 4) {
    confidence = 'high'; // Make+model match, clearly ahead
  } else if (bestScore >= 6) {
    confidence = 'medium'; // Good match but could be ambiguous
  } else if (bestScore >= 3) {
    confidence = 'low'; // Partial match
  } else {
    confidence = 'none';
    return { vehicleId: null, confidence: 'none', matchedVehicleName: null, angleHint };
  }

  return {
    vehicleId: bestVehicle.id,
    confidence,
    matchedVehicleName: bestVehicle.name,
    angleHint,
  };
}
