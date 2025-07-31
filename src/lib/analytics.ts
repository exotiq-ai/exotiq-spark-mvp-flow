import React from 'react';
import { FEATURE_FLAGS } from './constants';

export interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp?: number;
}

class Analytics {
  private isEnabled: boolean;
  private queue: AnalyticsEvent[] = [];

  constructor() {
    this.isEnabled = FEATURE_FLAGS.enableTelemetry;
  }

  // Track an event
  track(event: string, properties?: Record<string, any>) {
    if (!this.isEnabled) return;

    const analyticsEvent: AnalyticsEvent = {
      event,
      properties: {
        ...properties,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    };

    this.queue.push(analyticsEvent);
    this.flush();
  }

  // Track page view
  page(path: string, properties?: Record<string, any>) {
    this.track('page_view', {
      path,
      title: document.title,
      referrer: document.referrer,
      ...properties,
    });
  }

  // Track user interaction
  interaction(element: string, action: string, properties?: Record<string, any>) {
    this.track('user_interaction', {
      element,
      action,
      ...properties,
    });
  }

  // Track performance metrics
  performance(metric: string, value: number, properties?: Record<string, any>) {
    this.track('performance_metric', {
      metric,
      value,
      ...properties,
    });
  }

  // Track errors
  error(error: Error, context?: Record<string, any>) {
    this.track('error', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      ...context,
    });
  }

  // Flush events to analytics service
  private async flush() {
    if (this.queue.length === 0) return;

    try {
      // In a real app, this would send to your analytics service
      if (process.env.NODE_ENV === 'development') {
        console.group('📊 Analytics Events');
        this.queue.forEach(event => {
          console.log(`🎯 ${event.event}:`, event.properties);
        });
        console.groupEnd();
      }

      // Send to analytics service
      // await fetch('/api/analytics', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ events: this.queue }),
      // });

      this.queue = [];
    } catch (error) {
      console.warn('Failed to send analytics events:', error);
    }
  }

  // Enable/disable analytics
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (!enabled) {
      this.queue = [];
    }
  }

  // Get user properties
  getUserProperties() {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      screenResolution: `${screen.width}x${screen.height}`,
      colorDepth: screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }
}

export const analytics = new Analytics();

// React hook for analytics
export const useAnalytics = () => {
  const trackEvent = React.useCallback((event: string, properties?: Record<string, any>) => {
    analytics.track(event, properties);
  }, []);

  const trackPage = React.useCallback((path: string, properties?: Record<string, any>) => {
    analytics.page(path, properties);
  }, []);

  const trackInteraction = React.useCallback((element: string, action: string, properties?: Record<string, any>) => {
    analytics.interaction(element, action, properties);
  }, []);

  return {
    track: trackEvent,
    page: trackPage,
    interaction: trackInteraction,
  };
};