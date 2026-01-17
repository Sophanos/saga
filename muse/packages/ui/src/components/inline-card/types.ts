/**
 * InlineCard types
 */

import type { ReactNode } from "react";

export type InlineCardVariant = "entity" | "widget" | "artifact-link";

export interface InlineCardProps {
  /** Card variant determines styling and behavior */
  variant?: InlineCardVariant;
  /** Accent color (CSS variable or color value) */
  accentColor?: string;
  /** Background color for accent elements */
  accentBg?: string;
  /** Whether card is expanded */
  isExpanded?: boolean;
  /** Whether card is pinned (prevents auto-collapse) */
  isPinned?: boolean;
  /** Whether card is being hovered */
  isHovered?: boolean;
  /** Called when hover state changes */
  onHoverChange?: (hovered: boolean) => void;
  /** Additional class names */
  className?: string;
  /** Card content */
  children?: ReactNode;
}

export interface InlineCardHeaderProps {
  /** Icon element */
  icon?: ReactNode;
  /** Card title */
  title: string;
  /** Badge text (e.g., entity type) */
  badge?: string;
  /** Subtitle/alias text */
  subtitle?: string;
  /** Action buttons (right side) */
  actions?: ReactNode;
  /** Close button handler */
  onClose?: () => void;
  /** Click handler (toggle expand) */
  onClick?: () => void;
  /** Whether to show actions (usually on hover) */
  showActions?: boolean;
  /** Accent color for badge */
  accentColor?: string;
  accentBg?: string;
  className?: string;
}

export interface InlineCardActionsProps {
  /** Whether actions are visible */
  visible?: boolean;
  className?: string;
  children?: ReactNode;
}

export interface InlineCardActionButtonProps {
  icon: ReactNode;
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  active?: boolean;
  variant?: "default" | "danger";
  className?: string;
}

export interface InlineCardTabsProps {
  tabs: InlineCardTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  accentColor?: string;
  className?: string;
}

export interface InlineCardTab {
  id: string;
  label: string;
  count?: number;
}

export interface InlineCardContentProps {
  /** Max height before scroll */
  maxHeight?: number | string;
  className?: string;
  children?: ReactNode;
}

export interface InlineCardInputProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  loading?: boolean;
  accentColor?: string;
  className?: string;
}
