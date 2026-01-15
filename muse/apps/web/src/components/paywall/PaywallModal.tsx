/**
 * PaywallModal Component
 * Craft-inspired paywall with Pro featured prominently, Team below
 */

import { useState, useCallback } from "react";
import { X, Check, ChevronDown, ChevronUp, Sparkles, Users } from "lucide-react";
import { Button, Card, cn } from "@mythos/ui";
import { useBilling } from "../../hooks/useBilling";
import type { BillingTier } from "../../stores/billing";

// Pricing config (matches convex/lib/tierConfig.ts)
const PRICING = {
  pro: { monthly: 15, yearly: 120 },
  team: { monthly: 50, yearly: 300 },
};

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type BillingInterval = "yearly" | "monthly";

// Feature bullets for Pro
const PRO_FEATURES = [
  "500K AI tokens/month",
  "20 projects",
  "All AI features",
  "Image generation",
  "Style adaptation",
];

// Feature bullets for Team
const TEAM_FEATURES = [
  "2M AI tokens/month",
  "100 projects",
  "10 team members",
  "Priority support",
  "API access",
];

// All benefits for expandable section
const ALL_BENEFITS = [
  { label: "Unlimited content", icon: Check },
  { label: "Advanced customization", icon: Check },
  { label: "Unlimited storage", icon: Check },
  { label: "Unlimited media upload", icon: Check },
  { label: "Advanced AI models", icon: Check },
  { label: "And much more...", icon: Check },
];

export function PaywallModal({ isOpen, onClose }: PaywallModalProps) {
  const [interval, setInterval] = useState<BillingInterval>("yearly");
  const [showAllBenefits, setShowAllBenefits] = useState(false);
  const { subscription, openCheckout, openPortal, isLoading } = useBilling();

  const handlePurchase = useCallback(
    async (tier: BillingTier) => {
      const billingInterval = interval === "yearly" ? "annual" : "monthly";
      await openCheckout(tier, billingInterval);
    },
    [interval, openCheckout]
  );

  const handleRestore = useCallback(() => {
    // On web, open the Stripe customer portal
    void openPortal();
  }, [openPortal]);

  if (!isOpen) return null;

  const proPrice = PRICING.pro;
  const teamPrice = PRICING.team;

  // Calculate prices
  const proMonthly = proPrice.monthly;
  const proYearly = proPrice.yearly;
  const proYearlyMonthly = Math.round(proYearly / 12);
  const proSavings = Math.round(((proMonthly * 12 - proYearly) / (proMonthly * 12)) * 100);

  const teamMonthly = teamPrice.monthly;
  const teamYearly = teamPrice.yearly;
  const teamYearlyMonthly = Math.round(teamYearly / 12);

  const isPro = subscription.tier === "pro";
  const isTeam = subscription.tier === "team";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      {/* Backdrop with gradient */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-mythos-bg-primary via-mythos-bg-secondary to-mythos-bg-primary/95 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative z-10 w-full max-w-lg mx-4">
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-mythos-bg-tertiary text-mythos-text-muted hover:text-mythos-text-primary z-20"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </Button>

        {/* Hero Section */}
        <div className="text-center mb-8 pt-4">
          <h1
            id="paywall-title"
            className="text-2xl font-semibold text-mythos-text-primary mb-2"
          >
            Order, without effort.
          </h1>
          <p className="text-mythos-text-muted">
            For people working inside complexity.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex p-1 rounded-lg bg-mythos-bg-tertiary/50">
            <button
              onClick={() => setInterval("yearly")}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md transition-colors relative",
                interval === "yearly"
                  ? "bg-mythos-bg-secondary text-mythos-text-primary"
                  : "text-mythos-text-muted hover:text-mythos-text-secondary"
              )}
            >
              Yearly
              {interval === "yearly" && (
                <span className="absolute -top-2 -right-2 px-1.5 py-0.5 text-[10px] font-medium bg-mythos-accent-green text-white rounded-full">
                  Save {proSavings}%
                </span>
              )}
            </button>
            <button
              onClick={() => setInterval("monthly")}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                interval === "monthly"
                  ? "bg-mythos-bg-secondary text-mythos-text-primary"
                  : "text-mythos-text-muted hover:text-mythos-text-secondary"
              )}
            >
              Monthly
            </button>
          </div>
        </div>

        {/* Pro Plan Card (Featured) */}
        <Card className="mb-4 border-mythos-accent-primary ring-1 ring-mythos-accent-primary/50 bg-mythos-bg-secondary/80 backdrop-blur">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-mythos-accent-primary" />
                <h3 className="text-lg font-semibold text-mythos-text-primary">
                  Pro
                </h3>
              </div>
              {isPro && (
                <span className="px-2 py-0.5 text-xs font-medium bg-mythos-accent-primary text-white rounded-full">
                  Current Plan
                </span>
              )}
            </div>

            {/* Features */}
            <ul className="space-y-2 mb-6">
              {PRO_FEATURES.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-2 text-sm text-mythos-text-secondary"
                >
                  <Check className="w-4 h-4 text-mythos-accent-green flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>

            {/* Pricing */}
            <div className="mb-4">
              {interval === "yearly" ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-sm text-mythos-text-muted line-through">
                    ${proMonthly}
                  </span>
                  <span className="text-2xl font-bold text-mythos-text-primary">
                    ${proYearlyMonthly}
                  </span>
                  <span className="text-sm text-mythos-text-muted">/month</span>
                </div>
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-mythos-text-primary">
                    ${proMonthly}
                  </span>
                  <span className="text-sm text-mythos-text-muted">/month</span>
                </div>
              )}
              <p className="text-xs text-mythos-text-muted mt-1">
                {interval === "yearly"
                  ? `First 12 months $${proYearlyMonthly}/mo, then $${proMonthly}/mo`
                  : "7-day free trial"}
              </p>
            </div>

            {/* CTA */}
            <Button
              className="w-full"
              size="lg"
              disabled={isPro || isLoading}
              onClick={() => handlePurchase("pro")}
            >
              {isPro ? "Current Plan" : "Start Free Trial"}
            </Button>
          </div>
        </Card>

        {/* Team Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-mythos-border-default" />
          <span className="text-xs text-mythos-text-muted font-medium uppercase tracking-wide">
            For teams
          </span>
          <div className="flex-1 h-px bg-mythos-border-default" />
        </div>

        {/* Team Plan Card (Secondary) */}
        <Card className="mb-6 border-mythos-border-default bg-mythos-bg-secondary/50 backdrop-blur">
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-mythos-text-muted" />
                <h3 className="text-base font-medium text-mythos-text-primary">
                  Team
                </h3>
              </div>
              {isTeam && (
                <span className="px-2 py-0.5 text-xs font-medium bg-mythos-accent-primary text-white rounded-full">
                  Current Plan
                </span>
              )}
            </div>

            {/* Compact features */}
            <p className="text-sm text-mythos-text-muted mb-3">
              {TEAM_FEATURES.slice(0, 3).join(" · ")}
            </p>

            {/* Pricing */}
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-semibold text-mythos-text-primary">
                  ${interval === "yearly" ? teamYearlyMonthly : teamMonthly}
                </span>
                <span className="text-sm text-mythos-text-muted">/month</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={isTeam || isLoading}
                onClick={() => handlePurchase("team")}
              >
                {isTeam ? "Current" : "Upgrade"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Show All Benefits */}
        <button
          onClick={() => setShowAllBenefits(!showAllBenefits)}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm text-mythos-text-muted hover:text-mythos-text-secondary transition-colors"
        >
          {showAllBenefits ? (
            <>
              Hide benefits <ChevronUp className="w-4 h-4" />
            </>
          ) : (
            <>
              Show all benefits <ChevronDown className="w-4 h-4" />
            </>
          )}
        </button>

        {/* Expandable Benefits */}
        {showAllBenefits && (
          <Card className="mt-4 mb-6 border-mythos-border-default bg-mythos-bg-secondary/50">
            <div className="p-5">
              <h4 className="text-sm font-medium text-mythos-text-primary mb-4">
                Remove all limits
              </h4>
              <p className="text-xs text-mythos-text-muted mb-4">
                Complex systems don't need more effort. They need coherence.
              </p>
              <ul className="space-y-2">
                {ALL_BENEFITS.map((benefit) => (
                  <li
                    key={benefit.label}
                    className="flex items-center gap-2 text-sm text-mythos-text-secondary"
                  >
                    <benefit.icon className="w-3 h-3 text-mythos-accent-green" />
                    {benefit.label}
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center py-4 border-t border-mythos-border-default/50">
          <p className="text-xs text-mythos-text-muted mb-2">
            Cancel anytime. Subscription renews automatically.
          </p>
          <div className="flex items-center justify-center gap-4 text-xs">
            <button
              onClick={handleRestore}
              className="text-mythos-text-muted hover:text-mythos-accent-primary transition-colors"
            >
              Restore purchases
            </button>
            <span className="text-mythos-border-default">·</span>
            <a
              href="/privacy"
              className="text-mythos-text-muted hover:text-mythos-accent-primary transition-colors"
            >
              Privacy
            </a>
            <span className="text-mythos-border-default">·</span>
            <a
              href="/terms"
              className="text-mythos-text-muted hover:text-mythos-accent-primary transition-colors"
            >
              Terms
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaywallModal;
