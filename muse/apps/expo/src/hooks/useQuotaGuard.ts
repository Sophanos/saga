/**
 * useQuotaGuard Hook (Expo)
 * Quota checking with upgrade prompts for native platforms
 */

import { useCallback, useMemo } from "react";
import { Alert, Linking, Platform } from "react-native";
import {
  createBillingStore,
  useCanUseAI as useCanUseAISelector,
  useUsagePercentage as useUsagePercentageSelector,
  type BillingTier,
} from "@mythos/state";
import { expoStorage } from "@mythos/storage";

// Create expo billing store
const useBillingStore = createBillingStore(expoStorage);

// Bound selectors
const useSubscription = () =>
  useBillingStore((s) => ({
    tier: s.tier,
    status: s.status,
    currentPeriodEnd: s.currentPeriodEnd,
  }));
const useUsage = () =>
  useBillingStore((s) => ({
    tokensUsed: s.tokensUsed,
    tokensIncluded: s.tokensIncluded,
    tokensRemaining: s.tokensRemaining,
  }));
const useBillingMode = () => useBillingStore((s) => s.billingMode);
const useCanUseAI = () => useCanUseAISelector(useBillingStore);
const useUsagePercentage = () => useUsagePercentageSelector(useBillingStore);

export type QuotaType = "ai" | "storage" | "projects" | "imageGen" | "collaboration";

export interface QuotaCheckResult {
  canProceed: boolean;
  used: number;
  limit: number | null;
  remaining: number;
  percentage: number;
  tier: string;
  billingMode: string;
}

export interface QuotaGuardResult extends QuotaCheckResult {
  promptUpgrade: (options?: PromptUpgradeOptions) => void;
  guard: (options?: PromptUpgradeOptions) => boolean;
  openPaywall: () => void;
}

export interface PromptUpgradeOptions {
  message?: string;
  feature?: string;
  useToast?: boolean;
}

const QUOTA_MESSAGES: Record<QuotaType, { title: string; description: string }> = {
  ai: {
    title: "AI Token Limit Reached",
    description: "Upgrade to continue using AI features",
  },
  storage: {
    title: "Storage Limit Reached",
    description: "Upgrade for more storage space",
  },
  projects: {
    title: "Project Limit Reached",
    description: "Upgrade to create more projects",
  },
  imageGen: {
    title: "Image Generation Unavailable",
    description: "Upgrade to Pro for image generation",
  },
  collaboration: {
    title: "Collaboration Unavailable",
    description: "Upgrade to Team for collaboration features",
  },
};

/**
 * Open the App Store subscription management
 */
async function openSubscriptionSettings() {
  if (Platform.OS === "ios") {
    // iOS Settings > Apple ID > Subscriptions
    await Linking.openURL("itms-apps://apps.apple.com/account/subscriptions");
  } else if (Platform.OS === "android") {
    // Google Play subscriptions
    await Linking.openURL(
      "https://play.google.com/store/account/subscriptions"
    );
  }
}

/**
 * Hook to check quotas and prompt upgrades
 */
export function useQuotaGuard(quotaType: QuotaType = "ai"): QuotaGuardResult {
  const subscription = useSubscription();
  const usage = useUsage();
  const billingMode = useBillingMode();
  const canUseAI = useCanUseAI();
  const usagePercentage = useUsagePercentage();

  const quotaCheck = useMemo((): QuotaCheckResult => {
    // BYOK users have unlimited AI tokens
    if (billingMode === "byok" && quotaType === "ai") {
      return {
        canProceed: true,
        used: usage.tokensUsed,
        limit: null,
        remaining: Infinity,
        percentage: 0,
        tier: subscription.tier,
        billingMode,
      };
    }

    switch (quotaType) {
      case "ai":
        return {
          canProceed: canUseAI,
          used: usage.tokensUsed,
          limit: usage.tokensIncluded || null,
          remaining: usage.tokensRemaining,
          percentage: usagePercentage,
          tier: subscription.tier,
          billingMode,
        };

      case "imageGen":
        const hasImageGen = subscription.tier !== "free";
        return {
          canProceed: hasImageGen && canUseAI,
          used: 0,
          limit: hasImageGen ? null : 0,
          remaining: hasImageGen ? Infinity : 0,
          percentage: 0,
          tier: subscription.tier,
          billingMode,
        };

      case "collaboration":
        const hasCollab =
          subscription.tier === "team" || subscription.tier === "enterprise";
        return {
          canProceed: hasCollab,
          used: 0,
          limit: hasCollab ? null : 0,
          remaining: hasCollab ? Infinity : 0,
          percentage: 0,
          tier: subscription.tier,
          billingMode,
        };

      default:
        return {
          canProceed: true,
          used: 0,
          limit: null,
          remaining: Infinity,
          percentage: 0,
          tier: subscription.tier,
          billingMode,
        };
    }
  }, [quotaType, billingMode, canUseAI, usage, usagePercentage, subscription.tier]);

  // Open native paywall (RevenueCat)
  const openPaywall = useCallback(async () => {
    // TODO: Integrate with RevenueCat paywall UI
    // For now, open subscription settings
    await openSubscriptionSettings();
  }, []);

  // Prompt upgrade with native alert
  const promptUpgrade = useCallback(
    (options?: PromptUpgradeOptions) => {
      const messages = QUOTA_MESSAGES[quotaType];
      const title = options?.message || messages.title;
      const description = options?.feature
        ? `${messages.description} to use ${options.feature}`
        : messages.description;

      Alert.alert(title, description, [
        { text: "Cancel", style: "cancel" },
        { text: "Upgrade", onPress: openPaywall },
      ]);
    },
    [quotaType, openPaywall]
  );

  // Guard function
  const guard = useCallback(
    (options?: PromptUpgradeOptions): boolean => {
      if (quotaCheck.canProceed) {
        return true;
      }
      promptUpgrade(options);
      return false;
    },
    [quotaCheck.canProceed, promptUpgrade]
  );

  return {
    ...quotaCheck,
    promptUpgrade,
    guard,
    openPaywall,
  };
}

/**
 * Simplified hook for AI quota only
 */
export function useAIQuotaGuard() {
  return useQuotaGuard("ai");
}

// Export billing store actions for refresh
export { useBillingStore };

export default useQuotaGuard;
