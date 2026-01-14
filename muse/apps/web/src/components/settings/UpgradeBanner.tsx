/**
 * UpgradeBanner Component
 * Craft-inspired inline banner for settings showing subscription status
 */

import React from "react";
import { Crown, ChevronRight, Clock } from "lucide-react";
import { Button, cn } from "@mythos/ui";
import { useBilling } from "../../hooks/useBilling";
import { useMythosStore } from "../../stores";

interface UpgradeBannerProps {
  className?: string;
}

const TIER_LABELS: Record<string, { name: string; badge: string }> = {
  free: { name: "Free", badge: "FREE" },
  pro: { name: "Pro", badge: "PRO" },
  team: { name: "Team", badge: "TEAM" },
  enterprise: { name: "Enterprise", badge: "ENT" },
};

export function UpgradeBanner({ className }: UpgradeBannerProps) {
  const { subscription } = useBilling();
  const openModal = useMythosStore((s) => s.openModal);

  const tierInfo = TIER_LABELS[subscription.tier] || TIER_LABELS.free;
  const isSubscribed = subscription.tier !== "free";
  const isTrial = subscription.status === "trialing";

  // Calculate days remaining in trial
  const trialDaysLeft = isTrial && subscription.currentPeriodEnd
    ? Math.max(0, Math.ceil((new Date(subscription.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const handleUpgradeClick = () => {
    openModal({ type: "paywall" });
  };

  return (
    <div
      className={cn(
        "relative rounded-xl overflow-hidden",
        "bg-gradient-to-br from-mythos-bg-tertiary via-mythos-bg-secondary to-mythos-bg-tertiary",
        "border border-mythos-border-default",
        className
      )}
    >
      {/* Subtle accent glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-mythos-accent-primary/5 to-transparent pointer-events-none" />

      <div className="relative p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-mythos-accent-primary/10">
            <Crown className="w-5 h-5 text-mythos-accent-primary" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-mythos-text-primary">Rhei</span>
              <span
                className={cn(
                  "px-1.5 py-0.5 text-[10px] font-semibold rounded",
                  isSubscribed
                    ? "bg-mythos-accent-primary text-white"
                    : "bg-mythos-bg-tertiary text-mythos-text-muted"
                )}
              >
                {tierInfo.badge}
              </span>
              {isTrial && trialDaysLeft !== null && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-mythos-accent-yellow/20 text-mythos-accent-yellow rounded">
                  <Clock className="w-3 h-3" />
                  {trialDaysLeft} days left
                </span>
              )}
            </div>

            <p className="text-sm text-mythos-text-muted leading-relaxed">
              {isSubscribed
                ? "Rhei catches drift while you stay in motion."
                : "Built so you don't have to hold it all."}
            </p>
          </div>

          {/* Action */}
          {!isSubscribed || isTrial ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUpgradeClick}
              className="flex-shrink-0 gap-1 text-mythos-accent-primary hover:text-mythos-accent-primary hover:bg-mythos-accent-primary/10"
            >
              Upgrade
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default UpgradeBanner;
