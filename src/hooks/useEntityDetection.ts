import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DetectedEntity {
  type: 'phone' | 'email' | 'booking' | 'customer' | 'vehicle';
  value: string;
  displayText: string;
  startIndex: number;
  endIndex: number;
}

// Entity regex patterns
const PATTERNS = {
  phone: /(\+?1?\s*\(?[0-9]{3}\)?[\s.-]?[0-9]{3}[\s.-]?[0-9]{4})\b/g,
  email: /\b([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)\b/g,
  // UUID pattern for booking IDs - strict validation
  uuid: /\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/gi,
};

// UUID validation helper
const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

export function useEntityDetection(content: string): DetectedEntity[] {
  const { user } = useAuth();

  return useMemo(() => {
    const entities: DetectedEntity[] = [];
    const processedRanges: Array<[number, number]> = [];

    // Helper to check if range overlaps with already processed ranges
    const isOverlapping = (start: number, end: number): boolean => {
      return processedRanges.some(([s, e]) => 
        (start >= s && start < e) || (end > s && end <= e) || (start <= s && end >= e)
      );
    };

    // Helper to add entity and mark range as processed
    const addEntity = (entity: DetectedEntity) => {
      if (!isOverlapping(entity.startIndex, entity.endIndex)) {
        entities.push(entity);
        processedRanges.push([entity.startIndex, entity.endIndex]);
      }
    };

    // Detect phone numbers
    const phoneMatches = content.matchAll(PATTERNS.phone);
    for (const match of phoneMatches) {
      if (match.index !== undefined) {
        addEntity({
          type: 'phone',
          value: match[1].replace(/[\s.-]/g, ''),
          displayText: match[1],
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }
    }

    // Detect email addresses
    const emailMatches = content.matchAll(PATTERNS.email);
    for (const match of emailMatches) {
      if (match.index !== undefined) {
        addEntity({
          type: 'email',
          value: match[1],
          displayText: match[1],
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }
    }

    // Detect UUIDs (potential booking/customer/vehicle IDs)
    // Only create entities for valid UUIDs
    const uuidMatches = content.matchAll(PATTERNS.uuid);
    for (const match of uuidMatches) {
      if (match.index !== undefined && isValidUUID(match[1])) {
        addEntity({
          type: 'booking',
          value: match[1],
          displayText: match[1].slice(0, 8) + '...',
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }
    }

    // Sort entities by start index
    entities.sort((a, b) => a.startIndex - b.startIndex);

    return entities;
  }, [content, user]);
}

// Helper function to split content into segments with entities
export function splitContentWithEntities(
  content: string,
  entities: DetectedEntity[]
): Array<{ type: 'text' | 'entity'; content: string; entity?: DetectedEntity }> {
  if (entities.length === 0) {
    return [{ type: 'text', content }];
  }

  const segments: Array<{ type: 'text' | 'entity'; content: string; entity?: DetectedEntity }> = [];
  let lastIndex = 0;

  for (const entity of entities) {
    // Add text before entity
    if (entity.startIndex > lastIndex) {
      segments.push({
        type: 'text',
        content: content.slice(lastIndex, entity.startIndex),
      });
    }

    // Add entity
    segments.push({
      type: 'entity',
      content: entity.displayText,
      entity,
    });

    lastIndex = entity.endIndex;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    segments.push({
      type: 'text',
      content: content.slice(lastIndex),
    });
  }

  return segments;
}
