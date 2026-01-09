import { Platform } from 'react-native';

declare global {
  interface Window {
    clarity?: ((...args: unknown[]) => void) & { q?: unknown[][] };
  }
}

let initialized = false;

export function initClarity() {
  if (initialized) return;
  if (Platform.OS !== 'web') return; // Clarity only works on web
  if (typeof window === 'undefined') return;

  const projectId = process.env.EXPO_PUBLIC_CLARITY_PROJECT_ID;
  if (!projectId) {
    console.warn('Clarity project ID not configured');
    return;
  }

  // Initialize clarity queue function
  window.clarity = window.clarity || function(...args: unknown[]) {
    (window.clarity as { q?: unknown[][] }).q = (window.clarity as { q?: unknown[][] }).q || [];
    (window.clarity as { q: unknown[][] }).q.push(args);
  };

  // Load Clarity script dynamically
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${projectId}`;
  const firstScript = document.getElementsByTagName('script')[0];
  firstScript?.parentNode?.insertBefore(script, firstScript);

  initialized = true;
}

export function identifyClarity(userId: string, sessionId?: string, pageId?: string, friendlyName?: string) {
  if (Platform.OS !== 'web') return;
  if (typeof window !== 'undefined' && window.clarity) {
    window.clarity("identify", userId, sessionId, pageId, friendlyName);
  }
}

export function setClarityTag(key: string, value: string | string[]) {
  if (Platform.OS !== 'web') return;
  if (typeof window !== 'undefined' && window.clarity) {
    window.clarity("set", key, value);
  }
}

export function trackClarityEvent(eventName: string) {
  if (Platform.OS !== 'web') return;
  if (typeof window !== 'undefined' && window.clarity) {
    window.clarity("event", eventName);
  }
}

// Consent management (GDPR)
export function setClarityConsent(adStorage: 'granted' | 'denied', analyticsStorage: 'granted' | 'denied') {
  if (Platform.OS !== 'web') return;
  if (typeof window !== 'undefined' && window.clarity) {
    window.clarity('consentv2', {
      ad_Storage: adStorage,
      analytics_Storage: analyticsStorage,
    });
  }
}

export function clearClarityCookies() {
  if (Platform.OS !== 'web') return;
  if (typeof window !== 'undefined' && window.clarity) {
    window.clarity('consent', false);
  }
}
