/**
 * Widget command definitions
 *
 * Converts widget capabilities into commands for command palette.
 * Platform-agnostic - actual execution is handled by the app.
 */

import type { Command } from '../types';
import {
  getCapabilitiesForSurface,
  isWidgetCapability,
  type WidgetCapability,
} from '@mythos/capabilities';

function widgetCapabilityToCommand(capability: WidgetCapability): Command {
  return {
    id: capability.id,
    label: capability.label,
    description: capability.description,
    category: 'widget',
    keywords: capability.keywords ?? [],
    shortcut: capability.shortcut,
    requiresSelection: capability.requiresSelection,
    // Note: Don't filter by requiresProject - show widgets always, handle missing project at execution time
    when: (ctx) => {
      // Only filter by selection requirement
      if (capability.requiresSelection && !ctx.hasSelection) {
        return false;
      }
      return true;
    },
    execute: () => {
      // Dispatch custom event for the app to handle
      // Apps listen to this and invoke the widget execution
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('command:widget', {
            detail: {
              widgetId: capability.id,
              widgetType: capability.widgetType,
              widgetLabel: capability.label,
              parameters: capability.parameters,
            },
          })
        );
      }
    },
  };
}

/**
 * Widget commands generated from capabilities registry
 */
export const widgetCommands: Command[] = getCapabilitiesForSurface('command_palette')
  .filter(isWidgetCapability)
  .filter((cap) => cap.id !== 'widget.ask-ai') // Ask AI is handled by chat
  .filter((cap) => cap.id !== 'widget.generate-name') // Not a real widget
  .map((capability) => widgetCapabilityToCommand(capability));
