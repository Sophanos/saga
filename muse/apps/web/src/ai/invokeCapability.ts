/**
 * Centralized capability invoker.
 *
 * Handles the invocation of capabilities based on their kind:
 * - chat_prompt: Sends a prompt to the chat
 * - tool: Invokes a tool with default args
 * - ui: Performs a UI action (navigation/modal)
 */

import type {
  Capability,
  CapabilityContext,
  UIAction,
} from "@mythos/capabilities";
import {
  isToolCapability,
  isPromptCapability,
  isUIActionCapability,
} from "@mythos/capabilities";
import type { ToolName, ToolArgsMap } from "@mythos/agent-protocol";

// =============================================================================
// Types
// =============================================================================

export type ConsoleTab = "chat" | "linter" | "search" | "dynamics" | "coach";
export type ModalType = "profile" | "settings" | "entityForm";

export interface CapabilityInvokerContext {
  /** Context for building prompts and default args */
  capabilityContext: CapabilityContext;
  /** Set active console tab */
  setActiveTab: (tab: ConsoleTab) => void;
  /** Open a modal */
  openModal: (modal: ModalType, payload?: unknown) => void;
  /**
   * Send a chat prompt.
   * If not provided, will only navigate to chat tab without sending.
   */
  sendChatPrompt?: (prompt: string) => void;
  /**
   * Invoke a tool with args.
   * If not provided, will only navigate to appropriate tab without invoking.
   */
  invokeTool?: <T extends ToolName>(
    toolName: T,
    args: Partial<ToolArgsMap[T]>
  ) => Promise<void>;
}

// =============================================================================
// Invoker
// =============================================================================

/**
 * Invoke a capability based on its kind.
 *
 * When sendChatPrompt/invokeTool are not provided, only navigates to the
 * appropriate tab without executing. This allows reuse in both full
 * execution contexts (AISidebar) and navigation-only contexts (command palette).
 */
export async function invokeCapability(
  capability: Capability,
  ctx: CapabilityInvokerContext
): Promise<void> {
  if (isPromptCapability(capability)) {
    // Build and send the prompt (if sendChatPrompt is available)
    if (ctx.sendChatPrompt) {
      const prompt = capability.buildPrompt(ctx.capabilityContext);
      ctx.sendChatPrompt(prompt);
    }
    ctx.setActiveTab("chat");
  } else if (isToolCapability(capability)) {
    if (ctx.invokeTool) {
      // Build default args and invoke the tool
      const defaultArgs = capability.buildDefaultArgs
        ? capability.buildDefaultArgs(ctx.capabilityContext)
        : {};
      await ctx.invokeTool(capability.toolName, defaultArgs);
    } else {
      // Navigate to appropriate tab for the tool
      const linterTools = ["check_consistency", "check_logic", "clarity_check"];
      if (linterTools.includes(capability.toolName)) {
        ctx.setActiveTab("linter");
      } else {
        ctx.setActiveTab("chat");
      }
    }
  } else if (isUIActionCapability(capability)) {
    // Perform the UI action
    handleUIAction(capability.action, ctx);
  }
}

/**
 * Handle a UI action.
 */
function handleUIAction(
  action: UIAction,
  ctx: CapabilityInvokerContext
): void {
  switch (action.type) {
    case "open_console_tab":
      ctx.setActiveTab(action.tab);
      break;
    case "open_modal":
      ctx.openModal(action.modal as ModalType, action.payload);
      break;
  }
}

/**
 * Check if a capability is available in the current context.
 */
export function isCapabilityAvailable(
  capability: Capability,
  ctx: CapabilityContext & { hasApiKey?: boolean }
): boolean {
  // Check selection requirement
  if (capability.requiresSelection && !ctx.selectionText) {
    return false;
  }

  // Check project requirement
  if (capability.requiresProject && !ctx.hasProject) {
    return false;
  }

  // Check API key requirement
  if (capability.requiresApiKey && !ctx.hasApiKey) {
    return false;
  }

  return true;
}
