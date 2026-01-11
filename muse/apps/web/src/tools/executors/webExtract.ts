/**
 * web_extract tool executor
 *
 * This tool auto-executes on the server to extract content from URLs.
 * No client-side execution needed.
 */

import type { WebExtractArgs, WebExtractResult } from "@mythos/agent-protocol";
import type { ToolDefinition, ToolExecutionResult } from "../types";

export const webExtractExecutor: ToolDefinition<WebExtractArgs, WebExtractResult> = {
  toolName: "web_extract",
  label: "Extract Page",
  requiresConfirmation: false,
  danger: "safe",

  renderSummary: (args) => {
    if (!args.url) return "Extract page content";
    try {
      const url = new URL(args.url);
      return `Reading: ${url.hostname}`;
    } catch {
      return `Reading: ${args.url.slice(0, 30)}...`;
    }
  },

  execute: async (): Promise<ToolExecutionResult<WebExtractResult>> => {
    return {
      success: false,
      error: "This tool executes on the server.",
    };
  },
};
