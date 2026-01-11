/**
 * web_search tool executor
 *
 * This tool auto-executes on the server to search the web.
 * No client-side execution needed.
 */

import type { WebSearchArgs, WebSearchResult } from "@mythos/agent-protocol";
import type { ToolDefinition, ToolExecutionResult } from "../types";

export const webSearchExecutor: ToolDefinition<WebSearchArgs, WebSearchResult> = {
  toolName: "web_search",
  label: "Web Search",
  requiresConfirmation: false,
  danger: "safe",

  renderSummary: (args) => {
    const query = args.query?.slice(0, 50) ?? "";
    return query ? `Searching: "${query}"` : "Web search";
  },

  execute: async (): Promise<ToolExecutionResult<WebSearchResult>> => {
    return {
      success: false,
      error: "This tool executes on the server.",
    };
  },
};
