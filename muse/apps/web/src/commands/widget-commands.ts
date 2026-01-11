import type { Command } from "./registry";
import {
  getCapabilitiesForSurface,
  getCapabilityIcon,
  isWidgetCapability,
  type WidgetCapability,
} from "@mythos/capabilities";
import { useWidgetExecutionStore } from "../stores/widgetExecution";

function widgetCapabilityToCommand(capability: WidgetCapability): Command {
  const Icon = getCapabilityIcon(capability.icon);

  return {
    id: capability.id,
    label: capability.label,
    description: capability.description,
    icon: Icon,
    category: "widget",
    keywords: capability.keywords ?? [],
    shortcut: capability.shortcut,
    requiredModule: capability.requiresProject ? "console" : undefined,
    requiresSelection: capability.requiresSelection,
    when: (ctx) => {
      if (capability.requiresProject && ctx.state.project.currentProject === null) {
        return false;
      }
      if (capability.requiresSelection && (!ctx.selectedText || ctx.selectedText.length === 0)) {
        return false;
      }
      return true;
    },
    execute: (ctx) => {
      const projectId = ctx.state.project.currentProject?.id;
      if (!projectId) return;

      const selection = ctx.editor
        ? {
            from: ctx.editor.state.selection.from,
            to: ctx.editor.state.selection.to,
          }
        : undefined;

      const defaultParams = capability.parameters?.reduce<Record<string, unknown>>((acc, param) => {
        if (param.type === "string" && param.default !== undefined) {
          acc[param.name] = param.default;
        }
        if (param.type === "enum" && param.default !== undefined) {
          acc[param.name] = param.default;
        }
        return acc;
      }, {});

      useWidgetExecutionStore.getState().start({
        widgetId: capability.id,
        widgetType: capability.widgetType,
        widgetLabel: capability.label,
        projectId,
        documentId: ctx.state.document.currentDocument?.id,
        selectionText: ctx.selectedText ?? undefined,
        selectionRange: selection,
        parameters: defaultParams,
      });
    },
  };
}

export const widgetCommands: Command[] = getCapabilitiesForSurface("command_palette")
  .filter(isWidgetCapability)
  .filter((cap) => cap.id !== "widget.ask-ai")
  .map((capability) => widgetCapabilityToCommand(capability));
