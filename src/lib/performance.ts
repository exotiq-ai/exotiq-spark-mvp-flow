import React from 'react';

// Performance monitoring utilities
export const performance = {
  // Mark performance milestones
  mark: (name: string) => {
    if ('performance' in window && 'mark' in window.performance) {
      window.performance.mark(name);
    }
  },

  // Measure performance between marks
  measure: (name: string, startMark: string, endMark?: string) => {
    if ('performance' in window && 'measure' in window.performance) {
      try {
        window.performance.measure(name, startMark, endMark);
        const measure = window.performance.getEntriesByName(name, 'measure')[0];
        return measure?.duration;
      } catch (error) {
        console.warn('Performance measurement failed:', error);
      }
    }
    return null;
  },

  // Get navigation timing
  getNavigationTiming: () => {
    if ('performance' in window && 'timing' in window.performance) {
      const timing = window.performance.timing;
      return {
        loadTime: timing.loadEventEnd - timing.navigationStart,
        domReadyTime: timing.domContentLoadedEventEnd - timing.navigationStart,
        responseTime: timing.responseEnd - timing.requestStart,
        renderTime: timing.domComplete - timing.domLoading,
      };
    }
    return null;
  },

  // Log performance metrics
  logMetrics: () => {
    const navigation = performance.getNavigationTiming();
    if (navigation) {
      console.group('🚀 Performance Metrics');
      console.log(`📊 Total Load Time: ${navigation.loadTime}ms`);
      console.log(`⚡ DOM Ready Time: ${navigation.domReadyTime}ms`);
      console.log(`🌐 Response Time: ${navigation.responseTime}ms`);
      console.log(`🎨 Render Time: ${navigation.renderTime}ms`);
      console.groupEnd();
    }
  },

  // Lazy loading utility
  lazyLoad: (importFn: () => Promise<{ default: React.ComponentType<any> }>) => {
    return React.lazy(importFn);
  },

  // Preload critical resources
  preloadResource: (href: string, as: string) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    link.as = as;
    document.head.appendChild(link);
  },

  // Optimize images
  optimizeImage: (src: string, width?: number, quality = 80) => {
    // In a real app, this would integrate with an image optimization service
    // For now, we'll just return the original src
    if (width) {
      return `${src}?w=${width}&q=${quality}`;
    }
    return `${src}?q=${quality}`;
  },
};

// Component performance wrapper
export const withPerformanceTracking = <P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) => {
  return (props: P) => {
    React.useEffect(() => {
      performance.mark(`${componentName}-mount-start`);
      return () => {
        performance.mark(`${componentName}-mount-end`);
        performance.measure(
          `${componentName}-mount-duration`,
          `${componentName}-mount-start`,
          `${componentName}-mount-end`
        );
      };
    }, []);

    return React.createElement(Component, props);
  };
};