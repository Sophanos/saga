import {
  MessageSquare,
  Sparkles,
  AlertTriangle,
  Zap,
  Brain,
  Eye,
  Scale,
  Wand2,
  ScanSearch,
  Globe,
  User,
  type LucideIcon,
} from "lucide-react";
import type { Command } from "./registry";
import {
  getCapabilitiesForSurface,
  isPromptCapability,
  isToolCapability,
  isUIActionCapability,
  type Capability,
} from "@mythos/capabilities";

// Icon mapping from string names to Lucide components
const ICON_MAP: Record<string, LucideIcon> = {
  MessageSquare,
  Sparkles,
  AlertTriangle,
  Zap,
  Brain,
  Eye,
  Scale,
  Wand2,
  ScanSearch,
  Globe,
  User,
};

/**
 * Convert a Capability to a Command.
 */
function capabilityToCommand(capability: Capability): Command {
  const Icon = ICON_MAP[capability.icon];

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
      if (isPromptCapability(capability)) {
        // Build prompt and switch to chat (prompt will be sent by user clicking in chat)
        // For now, just switch to chat tab
        ctx.setActiveTab("chat");
      } else if (isToolCapability(capability)) {
        // For tools invoked via command palette, switch to chat or linter
        // The actual tool execution happens in the chat context
        if (capability.toolName === "check_consistency" || capability.toolName === "check_logic") {
          ctx.setActiveTab("linter");
        } else if (capability.toolName === "clarity_check") {
          ctx.setActiveTab("linter");
        } else {
          ctx.setActiveTab("chat");
        }
      } else if (isUIActionCapability(capability)) {
        const action = capability.action;
        if (action.type === "open_console_tab") {
          ctx.setActiveTab(action.tab);
        } else if (action.type === "open_modal") {
          const modalPayload = action.payload as Record<string, unknown> | undefined;
          ctx.openModal({ type: action.modal as "profile" | "settings", ...modalPayload });
        }
      }
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
