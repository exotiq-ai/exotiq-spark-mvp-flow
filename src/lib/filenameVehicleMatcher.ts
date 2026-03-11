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

// Multi-word makes that get split by normalizer
const MULTI_WORD_MAKES = [
  'rolls-royce',
  'rolls royce',
  'mercedes-benz',
  'mercedes benz',
  'aston martin',
  'land rover',
  'alfa romeo',
  'de tomaso',
];

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
 * Check if a multi-word make is present by joining adjacent tokens.
 */
function findMultiWordMake(tokens: string[], make: string): boolean {
  const makeParts = make.replace('-', ' ').split(/\s+/);
  if (makeParts.length < 2) return false;

  for (let i = 0; i <= tokens.length - makeParts.length; i++) {
    let allMatch = true;
    for (let j = 0; j < makeParts.length; j++) {
      if (tokens[i + j] !== makeParts[j]) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) return true;
  }
  return false;
}

/**
 * Score a filename against a single vehicle.
 * Returns a numeric score (0 = no match).
 *
 * Scoring:
 *  - Make match: +5
 *  - Model match: proportional to model words matched (up to +10)
 *  - Color match: +3
 *  - Year match: +1
 */
function scoreVehicle(tokens: string[], vehicle: MatchableVehicle): number {
  let score = 0;
  const make = vehicle.make?.toLowerCase();
  const model = vehicle.model?.toLowerCase();
  const color = vehicle.color?.toLowerCase();

  // --- Make matching (handles hyphenated & multi-word) ---
  let hasMake = false;
  if (make) {
    if (tokens.includes(make)) {
      hasMake = true;
    } else if (MULTI_WORD_MAKES.some(m => m.replace('-', ' ').replace(/\s+/g, ' ') === make.replace('-', ' '))) {
      hasMake = findMultiWordMake(tokens, make);
    }
  }

  // --- Model matching (proportional word coverage) ---
  let modelScore = 0;
  if (model) {
    const modelWords = model.split(/\s+/).filter(w => w.length > 0);
    const matchedWords = modelWords.filter(mw => tokens.includes(mw));
    if (modelWords.length > 0 && matchedWords.length > 0) {
      // Proportional: all words = 10, partial = proportional
      modelScore = Math.round((matchedWords.length / modelWords.length) * 10);
    }
  }

  if (hasMake && modelScore > 0) {
    score += 5 + modelScore; // Make (5) + proportional model (up to 10) = up to 15
  } else if (hasMake) {
    score += 5; // Make-only
  } else if (modelScore > 0) {
    score += Math.max(modelScore - 2, 1); // Model-only, slightly discounted
  }

  // Color match (strong tiebreaker)
  if (color && tokens.includes(color)) {
    score += 3;
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

  if (bestScore >= 12 && gap >= 3) {
    confidence = 'high'; // Make+full model+color, clearly ahead
  } else if (bestScore >= 8 && gap >= 2) {
    confidence = 'high'; // Make+model match with reasonable gap
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
