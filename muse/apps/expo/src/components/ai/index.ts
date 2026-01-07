/**
 * AI Components - Notion-inspired AI chat panel system
 *
 * Main components:
 * - AIPanel: Full chat panel (sticky or floating)
 * - AIFloatingButton: FAB to open panel when closed
 *
 * Sub-components (used internally):
 * - MuseAvatar: AI persona avatar
 * - ChatSelector: Chat history dropdown
 * - ModelSelector: AI model selection dropdown
 * - ContextScope: Context source selection dropdown
 * - QuickActions: Writer-focused quick action cards
 * - AIPanelInput: Rich input bar with context chips
 * - WelcomeState: Empty chat welcome screen
 */

export { AIPanel } from './AIPanel';
export { AIFloatingButton } from './AIFloatingButton';
export { MuseAvatar } from './MuseAvatar';
export { ChatSelector } from './ChatSelector';
export { ModelSelector, ModelSelectorTrigger } from './ModelSelector';
export { ContextScope, ContextScopeTrigger } from './ContextScope';
export { QuickActions } from './QuickActions';
export { AIPanelInput } from './AIPanelInput';
export { WelcomeState } from './WelcomeState';
