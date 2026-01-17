/**
 * InlineCard - Unified card system for entities, widgets, and artifact links
 *
 * Usage:
 * ```tsx
 * import {
 *   InlineCard,
 *   InlineCardHeader,
 *   InlineCardBody,
 *   InlineCardTabs,
 *   InlineCardContent,
 *   InlineCardInput,
 *   InlineCardActions,
 *   InlineCardActionButton,
 *   useCardBehavior,
 * } from '@mythos/ui';
 *
 * function EntityCard({ entity }) {
 *   const { isExpanded, isHovered, toggle, ... } = useCardBehavior();
 *
 *   return (
 *     <InlineCard
 *       variant="entity"
 *       accentColor={entity.color}
 *       isExpanded={isExpanded}
 *       isHovered={isHovered}
 *       onHoverChange={setIsHovered}
 *     >
 *       <InlineCardHeader
 *         icon={<UserIcon />}
 *         title={entity.name}
 *         badge={entity.type}
 *         onClick={toggle}
 *         showActions={isHovered}
 *         actions={<InlineCardActionButton icon={<Pin />} label="Pin" />}
 *       />
 *       <InlineCardBody isExpanded={isExpanded}>
 *         <InlineCardTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
 *         <InlineCardContent>{content}</InlineCardContent>
 *         <InlineCardInput placeholder="Refine..." onSubmit={handleRefine} />
 *       </InlineCardBody>
 *     </InlineCard>
 *   );
 * }
 * ```
 */

// Components
export { InlineCard } from "./InlineCard";
export { InlineCardHeader } from "./InlineCardHeader";
export { InlineCardBody } from "./InlineCardBody";
export { InlineCardTabs } from "./InlineCardTabs";
export { InlineCardContent } from "./InlineCardContent";
export { InlineCardInput } from "./InlineCardInput";
export { InlineCardActions, InlineCardActionButton } from "./InlineCardActions";

// Hook
export { useCardBehavior } from "./useCardBehavior";

// Types
export type {
  InlineCardVariant,
  InlineCardProps,
  InlineCardHeaderProps,
  InlineCardActionsProps,
  InlineCardActionButtonProps,
  InlineCardTabsProps,
  InlineCardTab,
  InlineCardContentProps,
  InlineCardInputProps,
} from "./types";

export type { UseCardBehaviorOptions, UseCardBehaviorReturn } from "./useCardBehavior";
