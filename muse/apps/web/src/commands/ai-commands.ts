import type { Command } from "./registry";
import {
  getCapabilitiesForSurface,
  getCapabilityIcon,
  type Capability,
} from "@mythos/capabilities";
import {
  invokeCapability,
  type CapabilityInvokerContext,
  type ConsoleTab,
  type ModalType,
} from "../ai/invokeCapability";

/**
 * Convert a Capability to a Command.
 */
function capabilityToCommand(capability: Capability): Command {
  const Icon = getCapabilityIcon(capability.icon);

  const command: Command = {
    id: capability.id,
    label: capability.label,
    description: capability.description,
    icon: Icon,
    category: "ai",
    keywords: capability.keywords ?? [],
    shortcut: capability.shortcut,
    requiredModule: capability.requiresProject ? "console" : undefined,
    when: (ctx) => {
      // Check project requirement
      if (capability.requiresProject && ctx.state.project.currentProject === null) {
        return false;
      }
      // Check selection requirement
      if (capability.requiresSelection && (!ctx.selectedText || ctx.selectedText.length === 0)) {
        return false;
      }
      return true;
    },
    execute: async (ctx) => {
      // Build invoker context for navigation-only mode (no sendChatPrompt/invokeTool)
      const invokerContext: CapabilityInvokerContext = {
        capabilityContext: {
          hasProject: ctx.state.project.currentProject !== null,
          selectionText: ctx.selectedText ?? undefined,
          documentTitle: ctx.state.document.currentDocument?.title,
        },
        setActiveTab: (tab: ConsoleTab) => ctx.setActiveTab(tab),
        openModal: (modal: ModalType, payload?: unknown) => {
          const modalPayload = payload as Record<string, unknown> | undefined;
          // Cast to satisfy ModalState discriminated union
          ctx.openModal({ type: modal, ...modalPayload } as Parameters<typeof ctx.openModal>[0]);
        },
        // No sendChatPrompt/invokeTool - command palette only navigates
      };
      await invokeCapability(capability, invokerContext);
    },
  };

  return command;
}

/**
 * Generate AI commands from the capability registry.
 */
function generateAICommands(): Command[] {
  const capabilities = getCapabilitiesForSurface("command_palette");
  return capabilities.map(capabilityToCommand);
}

// Export the generated commands
export const aiCommands: Command[] = generateAICommands();
