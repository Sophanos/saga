/**
 * React Hooks for Consent Management
 *
 * Provides hooks and context for consent UI components.
 * Uses Zustand for state management with React integration.
 */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { create } from 'zustand';
import type { ConsentState, ConsentCategories } from './types';
import { DEFAULT_CONSENT_STATE } from './types';
import { ConsentManager } from './manager';

// ============================================================================
// Zustand Store
// ============================================================================

interface ConsentStore {
  state: ConsentState;
  manager: ConsentManager | null;
  initialized: boolean;
  setManager: (manager: ConsentManager) => void;
  setState: (state: ConsentState) => void;
  setInitialized: (initialized: boolean) => void;
}

export const useConsentStore = create<ConsentStore>((set) => ({
  state: DEFAULT_CONSENT_STATE,
  manager: null,
  initialized: false,
  setManager: (manager) => set({ manager }),
  setState: (state) => set({ state }),
  setInitialized: (initialized) => set({ initialized }),
}));

// ============================================================================
// Context
// ============================================================================

interface ConsentContextValue {
  /** Current consent state */
  state: ConsentState;
  /** Whether consent manager is initialized */
  initialized: boolean;
  /** Whether consent banner should be shown */
  needsConsent: boolean;
  /** Grant all consent */
  grantAll: () => Promise<void>;
  /** Deny all non-essential consent */
  denyAll: () => Promise<void>;
  /** Update specific categories */
  updateConsent: (categories: Partial<ConsentCategories>) => Promise<void>;
  /** Revoke all consent and clear data */
  revokeConsent: () => Promise<void>;
  /** Check if analytics is enabled */
  hasAnalyticsConsent: boolean;
  /** Check if session replay is enabled */
  hasSessionReplayConsent: boolean;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface ConsentProviderProps {
  manager: ConsentManager;
  children: ReactNode;
}

export function ConsentProvider({ manager, children }: ConsentProviderProps) {
  const { state, setManager, setState, setInitialized, initialized } = useConsentStore();
  const [isReady, setIsReady] = useState(false);

  // Initialize manager
  useEffect(() => {
    setManager(manager);

    manager.init().then((initialState) => {
      setState(initialState);
      setInitialized(true);
      setIsReady(true);
    });

    // Subscribe to consent changes
    const originalConfig = (manager as unknown as { config: { onConsentChange?: (state: ConsentState) => void } }).config;
    const originalOnChange = originalConfig.onConsentChange;
    originalConfig.onConsentChange = (newState: ConsentState) => {
      setState(newState);
      originalOnChange?.(newState);
    };

    return () => {
      originalConfig.onConsentChange = originalOnChange;
    };
  }, [manager, setManager, setState, setInitialized]);

  const grantAll = useCallback(async () => {
    await manager.grantAll();
  }, [manager]);

  const denyAll = useCallback(async () => {
    await manager.denyAll();
  }, [manager]);

  const updateConsent = useCallback(
    async (categories: Partial<ConsentCategories>) => {
      await manager.updateConsent(categories);
    },
    [manager]
  );

  const revokeConsent = useCallback(async () => {
    await manager.revokeConsent();
  }, [manager]);

  const value: ConsentContextValue = {
    state,
    initialized: initialized && isReady,
    needsConsent: state.status === 'pending',
    grantAll,
    denyAll,
    updateConsent,
    revokeConsent,
    hasAnalyticsConsent: state.categories.analytics === 'granted',
    hasSessionReplayConsent: state.categories.sessionReplay === 'granted',
  };

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to access consent management
 */
export function useConsent(): ConsentContextValue {
  const context = useContext(ConsentContext);
  if (!context) {
    throw new Error('useConsent must be used within a ConsentProvider');
  }
  return context;
}

/**
 * Hook to check if consent banner should be shown
 */
export function useNeedsConsent(): boolean {
  const { needsConsent, initialized } = useConsent();
  return initialized && needsConsent;
}

/**
 * Hook for consent banner actions
 */
export function useConsentBanner() {
  const { needsConsent, initialized, grantAll, denyAll, state } = useConsent();

  return {
    /** Show banner when initialized and consent pending */
    show: initialized && needsConsent,
    /** Accept all cookies */
    accept: grantAll,
    /** Reject non-essential cookies */
    reject: denyAll,
    /** Current consent status */
    status: state.status,
  };
}

/**
 * Hook for consent settings UI (preferences modal)
 */
export function useConsentSettings() {
  const { state, updateConsent, revokeConsent, initialized } = useConsent();

  const setAnalytics = useCallback(
    (enabled: boolean) => {
      updateConsent({ analytics: enabled ? 'granted' : 'denied' });
    },
    [updateConsent]
  );

  const setSessionReplay = useCallback(
    (enabled: boolean) => {
      updateConsent({ sessionReplay: enabled ? 'granted' : 'denied' });
    },
    [updateConsent]
  );

  return {
    initialized,
    categories: state.categories,
    setAnalytics,
    setSessionReplay,
    revokeAll: revokeConsent,
    lastUpdated: state.updatedAt,
  };
}
