/**
 * BillingSettings Component
 * Subscription management, usage dashboard, and billing mode toggle
 */

import { useState, useCallback } from "react";
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
      "10 projects",
      "All AI features",
      "$0.10/1K overage",
    ],
  },
  pro_plus: {
    name: "Pro+",
    description: "For power users",
    tokens: "2M",
    priceIncluded: "$40",
    priceByok: "$20",
    features: [
      "2M AI tokens/month",
      "Unlimited projects",
      "5 collaborators",
      "$0.08/1K overage",
    ],
  },
  team: {
    name: "Team",
    description: "For writing teams",
    tokens: "10M",
    priceIncluded: "$99",
    priceByok: "$49",
    features: [
      "10M AI tokens/month",
      "Unlimited everything",
      "Unlimited collaborators",
      "$0.05/1K overage",
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

function TierCard({
  tier,
  billingMode,
  isCurrent,
  onSelect,
  isLoading,
}: TierCardProps) {
  const config = TIER_CONFIG[tier];
  const price =
    billingMode === "byok" ? config.priceByok : config.priceIncluded;

  return (
    <Card
      className={cn(
        "relative border-mythos-text-muted/20 transition-all",
        isCurrent && "border-mythos-accent-cyan ring-1 ring-mythos-accent-cyan"
      )}
    >
      {isCurrent && (
        <div className="absolute -top-2 left-4 px-2 py-0.5 text-xs font-medium bg-mythos-accent-cyan text-mythos-bg-primary rounded-sm">
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
          <Zap className="w-4 h-4 text-mythos-accent-cyan" />
          <span className="text-mythos-text-secondary">
            {config.tokens} tokens included
          </span>
        </div>

        <ul className="space-y-2">
          {config.features.map((feature, i) => (
            <li
              key={i}
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
          disabled={isCurrent || isLoading || tier === "free"}
          onClick={() => onSelect(tier)}
        >
          {isCurrent ? (
            "Current Plan"
          ) : tier === "free" ? (
            "Included"
          ) : isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Upgrade"
          )}
        </Button>
      </CardContent>
    </Card>
  );
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
  } = useBilling();

  const { key: apiKey, saveKey, hasKey } = useApiKey();
  const [showByokInput, setShowByokInput] = useState(false);
  const [byokKeyInput, setByokKeyInput] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [activeTab, setActiveTab] = useState<"usage" | "plans">("usage");

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
      await switchBillingMode("byok", byokKeyInput.trim());
      setShowByokInput(false);
    }
  }, [byokKeyInput, saveKey, switchBillingMode]);

  const handleUpgrade = useCallback(
    async (tier: BillingTier) => {
      await openCheckout(tier);
    },
    [openCheckout]
  );

  const getTierBadgeColor = (tier: BillingTier) => {
    switch (tier) {
      case "free":
        return "bg-mythos-text-muted/20 text-mythos-text-muted";
      case "pro":
        return "bg-mythos-accent-cyan/20 text-mythos-accent-cyan";
      case "pro_plus":
        return "bg-mythos-accent-yellow/20 text-mythos-accent-yellow";
      case "team":
        return "bg-mythos-accent-purple/20 text-mythos-accent-purple";
    }
  };

  const getModeIcon = (mode: BillingMode) => {
    switch (mode) {
      case "managed":
        return <CreditCard className="w-4 h-4 text-mythos-accent-cyan" />;
      case "byok":
        return <Key className="w-4 h-4 text-mythos-accent-cyan" />;
    }
  };

  const getModeLabel = (mode: BillingMode) => {
    switch (mode) {
      case "managed":
        return "Managed";
      case "byok":
        return "BYOK";
    }
  };

  const getModeDescription = (mode: BillingMode) => {
    switch (mode) {
      case "managed":
        return "AI tokens included in your plan.";
      case "byok":
        return "Bring your own API key. 50% off subscription.";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-mythos-bg-primary/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <Card className="relative z-10 w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden shadow-xl border-mythos-text-muted/30">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-mythos-accent-cyan" />
              <CardTitle className="text-lg">Billing & Usage</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
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
              <span>{error}</span>
            </div>
          )}

          {/* Current Plan Card */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-mythos-bg-tertiary/50">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-mythos-bg-secondary">
                <Crown className="w-5 h-5 text-mythos-accent-cyan" />
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
            <h4 className="text-sm font-medium text-mythos-text-primary">
              Billing Mode
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {(["managed", "byok"] as BillingMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleModeSwitch(mode)}
                  disabled={isLoading}
                  className={cn(
                    "p-4 rounded-lg border text-left transition-all",
                    billingMode === mode
                      ? "border-mythos-accent-cyan bg-mythos-accent-cyan/10"
                      : "border-mythos-text-muted/20 hover:border-mythos-text-muted/40"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {getModeIcon(mode)}
                    <span className="font-medium text-mythos-text-primary">
                      {getModeLabel(mode)}
                    </span>
                    {billingMode === mode && (
                      <Check className="w-4 h-4 text-mythos-accent-cyan ml-auto" />
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
              <div className="p-4 rounded-lg border border-mythos-text-muted/20 space-y-3">
                <div className="flex items-center gap-2 text-sm text-mythos-accent-yellow">
                  <AlertCircle className="w-4 h-4" />
                  <span>Enter your OpenRouter API key to continue</span>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
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
                  className="inline-flex items-center gap-1.5 text-sm text-mythos-accent-cyan hover:underline"
                >
                  Get an API key from OpenRouter
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 p-1 rounded-lg bg-mythos-bg-tertiary/50">
            <button
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
            <UsageDashboard
              usage={usage}
              periodEnd={subscription.currentPeriodEnd ?? undefined}
            />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {(["free", "pro", "pro_plus", "team"] as BillingTier[]).map(
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

        <CardFooter className="flex justify-end gap-2 pt-4 border-t border-mythos-text-muted/20">
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default BillingSettings;
