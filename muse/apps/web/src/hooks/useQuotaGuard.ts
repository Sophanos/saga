/**
 * useQuotaGuard Hook
 * Centralized quota checking with upgrade prompts
 */

import { useCallback, useMemo } from "react";
import { toast } from "@mythos/ui";
import {
  useSubscription,
  useUsage,
  useBillingMode,
  useCanUseAI,
  useUsagePercentage,
} from "../stores/billing";
import { useIsTrialExhausted, useServerTrialStatus } from "../stores/anonymous";
import { useMythosStore } from "../stores";

export type QuotaType = "ai" | "storage" | "projects" | "imageGen" | "collaboration";

export interface QuotaCheckResult {
  /** Whether the user can proceed with the action */
  canProceed: boolean;
  /** Current usage amount */
  used: number;
  /** Total limit (null = unlimited) */
  limit: number | null;
  /** Remaining amount (Infinity = unlimited) */
  remaining: number;
  /** Usage percentage (0-100) */
  percentage: number;
  /** Whether this is a trial user */
  isTrial: boolean;
  /** User's current tier */
  tier: string;
  /** Billing mode */
  billingMode: string;
}

export interface QuotaGuardResult extends QuotaCheckResult {
  /** Show upgrade prompt (toast or modal based on context) */
  promptUpgrade: (options?: PromptUpgradeOptions) => void;
  /** Check and prompt if needed - returns true if can proceed */
  guard: (options?: PromptUpgradeOptions) => boolean;
  /** Open the paywall modal directly */
  openPaywall: () => void;
}

export interface PromptUpgradeOptions {
  /** Custom message for the prompt */
  message?: string;
  /** Feature name for context */
  feature?: string;
  /** Use toast instead of modal */
  useToast?: boolean;
}

const QUOTA_MESSAGES: Record<QuotaType, { title: string; description: string }> = {
  ai: {
    title: "AI token limit reached",
    description: "Upgrade to continue using AI features",
  },
  storage: {
    title: "Storage limit reached",
    description: "Upgrade for more storage space",
  },
  projects: {
    title: "Project limit reached",
    description: "Upgrade to create more projects",
  },
  imageGen: {
    title: "Image generation unavailable",
    description: "Upgrade to Pro for image generation",
  },
  collaboration: {
    title: "Collaboration unavailable",
    description: "Upgrade to Team for collaboration features",
  },
};

/**
 * Hook to check quotas and prompt upgrades
 */
export function useQuotaGuard(quotaType: QuotaType = "ai"): QuotaGuardResult {
  const subscription = useSubscription();
  const usage = useUsage();
  const billingMode = useBillingMode();
  const canUseAI = useCanUseAI();
  const usagePercentage = useUsagePercentage();
  const isTrialExhausted = useIsTrialExhausted();
  const trialStatus = useServerTrialStatus();
  const openModal = useMythosStore((s) => s.openModal);

  // Determine if this is a trial user (not logged in or no subscription)
  const isTrial = subscription.tier === "free" && subscription.status !== "active";

  // Calculate quota based on type
  const quotaCheck = useMemo((): QuotaCheckResult => {
    // BYOK users have unlimited AI tokens
    if (billingMode === "byok" && quotaType === "ai") {
      return {
        canProceed: true,
        used: usage.tokensUsed,
        limit: null,
        remaining: Infinity,
        percentage: 0,
        isTrial,
        tier: subscription.tier,
        billingMode,
      };
    }

    // Trial user check
    if (isTrial) {
      const limit = trialStatus.limit ?? 5;
      const used = trialStatus.used ?? 0;
      return {
        canProceed: !isTrialExhausted,
        used,
        limit,
        remaining: Math.max(0, limit - used),
        percentage: limit > 0 ? Math.min(100, (used / limit) * 100) : 0,
        isTrial: true,
        tier: "trial",
        billingMode,
      };
    }

    // Authenticated user quota checks
    switch (quotaType) {
      case "ai":
        return {
          canProceed: canUseAI,
          used: usage.tokensUsed,
          limit: usage.tokensIncluded || null,
          remaining: usage.tokensRemaining,
          percentage: usagePercentage,
          isTrial: false,
          tier: subscription.tier,
          billingMode,
        };

      case "imageGen":
        // Image gen requires Pro or higher
        const hasImageGen = subscription.tier !== "free";
        return {
          canProceed: hasImageGen && canUseAI,
          used: 0,
          limit: hasImageGen ? null : 0,
          remaining: hasImageGen ? Infinity : 0,
          percentage: 0,
          isTrial: false,
          tier: subscription.tier,
          billingMode,
        };

      case "collaboration":
        // Collaboration requires Team or higher
        const hasCollab = subscription.tier === "team" || subscription.tier === "enterprise";
        return {
          canProceed: hasCollab,
          used: 0,
          limit: hasCollab ? null : 0,
          remaining: hasCollab ? Infinity : 0,
          percentage: 0,
          isTrial: false,
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
          isTrial: false,
          tier: subscription.tier,
          billingMode,
        };
    }
  }, [
    quotaType,
    billingMode,
    isTrial,
    isTrialExhausted,
    trialStatus,
    canUseAI,
    usage,
    usagePercentage,
    subscription.tier,
  ]);

  // Open paywall modal
  const openPaywall = useCallback(() => {
    openModal({ type: "paywall" });
  }, [openModal]);

  // Prompt upgrade (toast or modal)
  const promptUpgrade = useCallback(
    (options?: PromptUpgradeOptions) => {
      const messages = QUOTA_MESSAGES[quotaType];
      const title = options?.message || messages.title;
      const description = options?.feature
        ? `${messages.description} to use ${options.feature}`
        : messages.description;

      if (options?.useToast) {
        toast.info(title, {
          description,
          action: {
            label: "Upgrade",
            onClick: openPaywall,
          },
          duration: 5000,
        });
      } else {
        openPaywall();
      }
    },
    [quotaType, openPaywall]
  );

  // Guard function - checks and prompts if needed
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

/**
 * Hook to show usage warning when approaching limit
 */
export function useUsageWarning(threshold: number = 80) {
  const { percentage, tier, isTrial, promptUpgrade } = useQuotaGuard("ai");

  const shouldWarn = percentage >= threshold && percentage < 100;
  const isExhausted = percentage >= 100;

  const showWarning = useCallback(() => {
    if (isExhausted) {
      promptUpgrade({ useToast: true });
    } else if (shouldWarn) {
      toast.warning(`${Math.round(percentage)}% of AI tokens used`, {
        description: isTrial
          ? "Sign up to get more tokens"
          : `Upgrade from ${tier} for more capacity`,
        action: {
          label: isTrial ? "Sign up" : "Upgrade",
          onClick: () => promptUpgrade(),
        },
        duration: 4000,
      });
    }
  }, [percentage, isExhausted, shouldWarn, isTrial, tier, promptUpgrade]);

  return { shouldWarn, isExhausted, showWarning, percentage };
}

export default useQuotaGuard;
