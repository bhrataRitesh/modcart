'use client';

import { useEffect } from 'react';
import { onCLS, onLCP, onTTFB, onINP } from 'web-vitals';

export function PerformanceMonitor() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      onCLS(console.log);
      onLCP(console.log);
      onTTFB(console.log);
      onINP(console.log);
    }
    
    // In production, we'd send these to a monitoring endpoint or Sentry
    const sendToAnalytics = ({ name, value, id }: any) => {
      // Potentially: Sentry.captureMessage(`Vital: ${name} = ${value}`);
      console.log(`[WebVitals] ${name}: ${value} (id: ${id})`);
    };

    onCLS(sendToAnalytics);
    onLCP(sendToAnalytics);
    onTTFB(sendToAnalytics);
    onINP(sendToAnalytics);
  }, []);

  return null;
}
