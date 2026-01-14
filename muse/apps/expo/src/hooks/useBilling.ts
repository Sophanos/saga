/**
 * useBilling Hook for Expo
 * Provides billing settings management using Convex React directly
 */

import { useCallback, useState } from "react";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { BillingMode } from "@mythos/state";

// Convex API types are too deep for expo typecheck; treat as untyped
const apiAny: any = api;

interface UseBillingResult {
  billingMode: BillingMode;
  preferredModel: string | null;
  isLoading: boolean;
  error: string | null;
  switchBillingMode: (mode: BillingMode) => Promise<boolean>;
  setPreferredModel: (model: string) => Promise<boolean>;
}

export function useBilling(): UseBillingResult {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Query billing settings
  const billingSettings = useQuery(
    apiAny.billingSettings?.getMyBillingSettings,
    isAuthenticated && !isAuthLoading ? {} : "skip"
  );

  // Mutations
  const setBillingModeMutation = useMutation(apiAny.billingSettings?.setMyBillingMode);
  const setPreferredModelMutation = useMutation(apiAny.billingSettings?.setMyPreferredModel);

  const switchBillingMode = useCallback(
    async (mode: BillingMode): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        await setBillingModeMutation({ mode });
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to switch billing mode");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [setBillingModeMutation]
  );

  const setPreferredModel = useCallback(
    async (model: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        await setPreferredModelMutation({ model });
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to set preferred model");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [setPreferredModelMutation]
  );

  return {
    billingMode: (billingSettings?.billingMode ?? "managed") as BillingMode,
    preferredModel: billingSettings?.preferredModel ?? null,
    isLoading: isLoading || isAuthLoading || billingSettings === undefined,
    error,
    switchBillingMode,
    setPreferredModel,
  };
}
