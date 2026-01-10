/**
 * BillingSettings Component
 * Subscription management, usage dashboard, and billing mode toggle
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  X,
  CreditCard,
  Crown,
  Zap,
  Key,
  ExternalLink,
  Check,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  cn,
} from "@mythos/ui";
import { useBilling } from "../../hooks/useBilling";
import { useApiKey } from "../../hooks/useApiKey";
import { UsageDashboard } from "./UsageDashboard";
import type { BillingTier, BillingMode } from "../../stores/billing";

interface BillingSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

// Tier configuration for display
const TIER_CONFIG: Record<
  BillingTier,
  {
    name: string;
    description: string;
    tokens: string;
    priceIncluded: string;
    priceByok: string;
    features: string[];
  }
> = {
  free: {
    name: "Free",
    description: "Get started with basic features",
    tokens: "10K",
    priceIncluded: "$0",
    priceByok: "$0",
    features: ["10K AI tokens/month", "3 projects", "Basic AI features"],
  },
  pro: {
    name: "Pro",
    description: "For serious writers",
    tokens: "500K",
    priceIncluded: "$20",
    priceByok: "$10",
    features: [
      "500K AI tokens/month",
      "20 projects",
      "All AI features",
      "Custom models",
    ],
  },
  team: {
    name: "Team",
    description: "For writing teams",
    tokens: "2M",
    priceIncluded: "$50",
    priceByok: "$25",
    features: [
      "2M AI tokens/month",
      "Team collaboration (10 seats)",
      "Priority support",
      "API access",
    ],
  },
  enterprise: {
    name: "Enterprise",
    description: "Custom plans for large organizations",
    tokens: "Unlimited",
    priceIncluded: "Custom",
    priceByok: "Custom",
    features: [
      "Unlimited AI tokens",
      "Custom limits + SLAs",
      "Dedicated support",
      "Security + compliance",
    ],
  },
};

interface TierCardProps {
  tier: BillingTier;
  billingMode: BillingMode;
  isCurrent: boolean;
  onSelect: (tier: BillingTier) => void;
  isLoading: boolean;
}

const TierCard = React.memo(function TierCard({
  tier,
  billingMode,
  isCurrent,
  onSelect,
  isLoading,
}: TierCardProps) {
  const config = TIER_CONFIG[tier];
  const price =
    billingMode === "byok" ? config.priceByok : config.priceIncluded;
  const isSelectable = isTierSelectable(tier);
  const actionLabel = getTierActionLabel(tier, isCurrent, isLoading);

  return (
    <Card
      className={cn(
        "relative border-mythos-border-default transition-all",
        isCurrent && "border-mythos-accent-primary ring-1 ring-mythos-accent-primary"
      )}
    >
      {isCurrent && (
        <div className="absolute -top-2 left-4 px-2 py-0.5 text-xs font-medium bg-mythos-accent-primary text-mythos-bg-primary rounded-sm">
          Current Plan
        </div>
      )}
      <CardContent className="pt-6 space-y-4">
        <div>
          <h4 className="text-lg font-semibold text-mythos-text-primary">
            {config.name}
          </h4>
          <p className="text-sm text-mythos-text-muted">{config.description}</p>
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-mythos-text-primary">
            {price}
          </span>
          {price !== "Custom" && (
            <span className="text-sm text-mythos-text-muted">/month</span>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Zap className="w-4 h-4 text-mythos-accent-primary" />
          <span className="text-mythos-text-secondary">
            {config.tokens} tokens included
          </span>
        </div>

        <ul className="space-y-2">
          {config.features.map((feature) => (
            <li
              key={feature}
              className="flex items-center gap-2 text-sm text-mythos-text-muted"
            >
              <Check className="w-3 h-3 text-mythos-accent-green" />
              {feature}
            </li>
          ))}
        </ul>

        <Button
          className="w-full"
          variant={isCurrent ? "outline" : "default"}
          disabled={isCurrent || isLoading || !isSelectable}
          onClick={() => onSelect(tier)}
        >
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
});

// Pure helper functions - moved outside component to avoid recreation on each render
function getTierBadgeColor(tier: BillingTier): string {
  switch (tier) {
    case "free":
      return "bg-mythos-bg-tertiary text-mythos-text-muted";
    case "pro":
      return "bg-mythos-accent-primary/20 text-mythos-accent-primary";
    case "team":
      return "bg-mythos-accent-purple/20 text-mythos-accent-purple";
    case "enterprise":
      return "bg-mythos-accent-yellow/20 text-mythos-accent-yellow";
  }
}

function getModeIcon(mode: BillingMode): React.ReactNode {
  switch (mode) {
    case "managed":
      return <CreditCard className="w-4 h-4 text-mythos-accent-primary" />;
    case "byok":
      return <Key className="w-4 h-4 text-mythos-accent-primary" />;
  }
}

function getModeLabel(mode: BillingMode): string {
  switch (mode) {
    case "managed":
      return "Managed";
    case "byok":
      return "BYOK";
  }
}

function getModeDescription(mode: BillingMode): string {
  switch (mode) {
    case "managed":
      return "AI tokens included in your plan.";
    case "byok":
      return "Bring your own API key. 50% off subscription.";
  }
}

function getTierActionLabel(
  tier: BillingTier,
  isCurrent: boolean,
  isLoading: boolean
): React.ReactNode {
  if (isCurrent) return "Current Plan";
  if (tier === "free") return "Included";
  if (tier === "enterprise") return "Contact Sales";
  if (isLoading) return <Loader2 className="w-4 h-4 animate-spin" />;
  return "Upgrade";
}

function isTierSelectable(tier: BillingTier): boolean {
  return tier !== "free" && tier !== "enterprise";
}

export function BillingSettings({ isOpen, onClose }: BillingSettingsProps) {
  const {
    subscription,
    usage,
    billingMode,
    isLoading,
    error,
    openCheckout,
    openPortal,
    switchBillingMode,
    refresh,
    clearError,
  } = useBilling();

  const { key: apiKey, saveKey, hasKey } = useApiKey();
  const [showByokInput, setShowByokInput] = useState(false);
  const [byokKeyInput, setByokKeyInput] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [activeTab, setActiveTab] = useState<"usage" | "plans">("usage");

  // Sync byokKeyInput when apiKey changes externally
  useEffect(() => {
    setByokKeyInput(apiKey);
  }, [apiKey]);

  const handleClose = useCallback(() => {
    setShowByokInput(false);
    setByokKeyInput(apiKey);
    onClose();
  }, [apiKey, onClose]);

  const handleModeSwitch = useCallback(
    async (mode: BillingMode) => {
      if (mode === "byok") {
        if (!hasKey) {
          setShowByokInput(true);
          return;
        }
      }
      await switchBillingMode(mode, mode === "byok" ? apiKey : undefined);
    },
    [switchBillingMode, apiKey, hasKey]
  );

  const handleByokSubmit = useCallback(async () => {
    if (byokKeyInput.trim()) {
      saveKey(byokKeyInput.trim());
      const success = await switchBillingMode("byok", byokKeyInput.trim());
      if (success) {
        setShowByokInput(false);
      }
    }
  }, [byokKeyInput, saveKey, switchBillingMode]);

  const handleUpgrade = useCallback(
    async (tier: BillingTier) => {
      await openCheckout(tier);
    },
    [openCheckout]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="billing-modal-title"
      onKeyDown={(e) => e.key === 'Escape' && handleClose()}
      data-testid="billing-modal"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-mythos-bg-primary/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <Card className="relative z-10 w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden shadow-xl border-mythos-border-default">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-mythos-accent-primary" />
              <CardTitle id="billing-modal-title" className="text-lg">Billing & Usage</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              aria-label="Close billing settings"
              className="h-8 w-8 text-mythos-text-muted hover:text-mythos-text-primary"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <CardDescription className="pt-1">
            Manage your subscription and track usage.
          </CardDescription>
        </CardHeader>

        <CardContent className="overflow-y-auto max-h-[calc(90vh-200px)] space-y-6">
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-mythos-accent-red/10 border border-mythos-accent-red/30 text-mythos-accent-red text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{error}</span>
              <Button variant="ghost" size="sm" onClick={refresh}>
                Retry
              </Button>
              <Button variant="ghost" size="sm" onClick={() => clearError()}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          )}

          {/* Current Plan Card */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-mythos-bg-tertiary/50">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-mythos-bg-secondary">
                <Crown className="w-5 h-5 text-mythos-accent-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-mythos-text-primary">
                    Current Plan
                  </span>
                  <span
                    className={cn(
                      "px-2 py-0.5 text-xs font-medium rounded-full",
                      getTierBadgeColor(subscription.tier)
                    )}
                    data-testid="billing-current-tier"
                  >
                    {TIER_CONFIG[subscription.tier].name}
                  </span>
                </div>
                <p className="text-sm text-mythos-text-muted">
                  {billingMode === "byok"
                    ? "Using your own API key"
                    : "Tokens included in plan"}
                </p>
              </div>
            </div>
            {subscription.tier !== "free" && (
              <Button
                variant="outline"
                size="sm"
                onClick={openPortal}
                disabled={isLoading}
                className="gap-1.5"
              >
                <ExternalLink className="w-3 h-3" />
                Manage
              </Button>
            )}
          </div>

          {/* Billing Mode Toggle */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-mythos-text-primary" id="billing-mode-label">
              Billing Mode
            </h4>
            <div role="radiogroup" aria-labelledby="billing-mode-label" className="grid grid-cols-2 gap-3">
              {(["managed", "byok"] as BillingMode[]).map((mode) => (
                <button
                  key={mode}
                  role="radio"
                  aria-checked={billingMode === mode}
                  onClick={() => handleModeSwitch(mode)}
                  disabled={isLoading}
                  className={cn(
                    "p-4 rounded-lg border text-left transition-all",
                    billingMode === mode
                      ? "border-mythos-accent-primary bg-mythos-accent-primary/10"
                      : "border-mythos-border-default hover:border-mythos-border-hover"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {getModeIcon(mode)}
                    <span className="font-medium text-mythos-text-primary">
                      {getModeLabel(mode)}
                    </span>
                    {billingMode === mode && (
                      <Check className="w-4 h-4 text-mythos-accent-primary ml-auto" />
                    )}
                  </div>
                  <p className="text-xs text-mythos-text-muted">
                    {getModeDescription(mode)}
                  </p>
                </button>
              ))}
            </div>

            {/* BYOK Key Input */}
            {showByokInput && (
              <div className="p-4 rounded-lg border border-mythos-border-default space-y-3">
                <div className="flex items-center gap-2 text-sm text-mythos-accent-yellow">
                  <AlertCircle className="w-4 h-4" />
                  <span>Enter your OpenRouter API key to continue</span>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      aria-label="OpenRouter API key"
                      type={showKey ? "text" : "password"}
                      value={byokKeyInput}
                      onChange={(e) => setByokKeyInput(e.target.value)}
                      placeholder="sk-or-v1-..."
                      className="pr-10 font-mono text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowKey(!showKey)}
                      aria-label={showKey ? "Hide API key" : "Show API key"}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    >
                      {showKey ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <Button
                    onClick={handleByokSubmit}
                    disabled={!byokKeyInput.trim() || isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowByokInput(false)}
                  >
                    Cancel
                  </Button>
                </div>
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-mythos-accent-primary hover:underline"
                >
                  Get an API key from OpenRouter
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>

          {/* Tab Navigation */}
          <div role="tablist" aria-label="Billing sections" className="flex gap-1 p-1 rounded-lg bg-mythos-bg-tertiary/50">
            <button
              role="tab"
              aria-selected={activeTab === "usage"}
              aria-controls="usage-panel"
              id="usage-tab"
              onClick={() => setActiveTab("usage")}
              className={cn(
                "flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors",
                activeTab === "usage"
                  ? "bg-mythos-bg-secondary text-mythos-text-primary"
                  : "text-mythos-text-muted hover:text-mythos-text-secondary"
              )}
            >
              Usage
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "plans"}
              aria-controls="plans-panel"
              id="plans-tab"
              onClick={() => setActiveTab("plans")}
              className={cn(
                "flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors",
                activeTab === "plans"
                  ? "bg-mythos-bg-secondary text-mythos-text-primary"
                  : "text-mythos-text-muted hover:text-mythos-text-secondary"
              )}
            >
              Plans
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "usage" ? (
            <div role="tabpanel" id="usage-panel" aria-labelledby="usage-tab">
              <UsageDashboard
                usage={usage}
                periodEnd={subscription.currentPeriodEnd ?? undefined}
              />
            </div>
          ) : (
            <div role="tabpanel" id="plans-panel" aria-labelledby="plans-tab" className="grid grid-cols-2 gap-4">
              {(["free", "pro", "team", "enterprise"] as BillingTier[]).map(
                (tier) => (
                  <TierCard
                    key={tier}
                    tier={tier}
                    billingMode={billingMode}
                    isCurrent={subscription.tier === tier}
                    onSelect={handleUpgrade}
                    isLoading={isLoading}
                  />
                )
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-end gap-2 pt-4 border-t border-mythos-border-default">
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default BillingSettings;
