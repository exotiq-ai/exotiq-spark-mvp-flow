import { useRef, useEffect, useCallback } from 'react';
import { devLog, devWarn } from '@/lib/logger';

interface RealtimeReconnectConfig {
  // Time (ms) of no events before considering channel stale
  staleThresholdMs: number;
  // Callback to force reconnection
  onReconnectNeeded: () => void;
  // Whether the feature is active
  isActive: boolean;
}

/**
 * Hook to detect and handle stale real-time channels.
 * 
 * When a tab is backgrounded for extended periods, Supabase websockets
 * may silently disconnect. This hook detects when the channel might
 * be stale and triggers a reconnection.
 */
export function useRealtimeReconnect(config: RealtimeReconnectConfig) {
  const {
    staleThresholdMs = 5 * 60 * 1000, // 5 minutes default
    onReconnectNeeded,
    isActive,
  } = config;

  // Track when we last received a real-time event
  const lastRealtimeEventTimestamp = useRef<number>(Date.now());
  const wasHiddenRef = useRef<boolean>(false);
  const hiddenAtRef = useRef<number>(0);

  // Call this whenever a real-time event is received
  const recordRealtimeEvent = useCallback(() => {
    lastRealtimeEventTimestamp.current = Date.now();
  }, []);

  // Visibility change handler
  useEffect(() => {
    if (!isActive) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is being hidden
        wasHiddenRef.current = true;
        hiddenAtRef.current = Date.now();
        devLog('[RealtimeReconnect] Tab hidden, tracking...');
      } else if (wasHiddenRef.current) {
        // Tab is becoming visible again after being hidden
        const hiddenDuration = Date.now() - hiddenAtRef.current;
        const timeSinceLastEvent = Date.now() - lastRealtimeEventTimestamp.current;
        
        devLog('[RealtimeReconnect] Tab visible after', Math.round(hiddenDuration / 1000), 's hidden,',
          Math.round(timeSinceLastEvent / 1000), 's since last event');

        // If tab was hidden AND we haven't received events in a while, reconnect
        if (hiddenDuration > 60000 && timeSinceLastEvent > staleThresholdMs) {
          devWarn('[RealtimeReconnect] Channel may be stale, requesting reconnection');
          onReconnectNeeded();
        }

        wasHiddenRef.current = false;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isActive, staleThresholdMs, onReconnectNeeded]);

  return {
    recordRealtimeEvent,
    lastEventTime: () => lastRealtimeEventTimestamp.current,
  };
}
