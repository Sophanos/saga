/**
 * Web Research Tools for the Saga agent.
 *
 * Uses Parallel Web AI SDK for web search and content extraction.
 * Requires PARALLEL_API_KEY environment variable.
 *
 * Two tools available:
 * - searchTool: Search the web for relevant pages
 * - extractTool: Extract full content from specific URLs
 */

import { searchTool, extractTool } from "@parallel-web/ai-sdk-tools";

/**
 * Web search tool - finds relevant pages based on query.
 * Returns search results with titles, URLs, and snippets.
 */
export const webSearchTool: typeof searchTool = searchTool;

/**
 * Web extract tool - reads full content from a URL.
 * Use after search to deep-dive into specific pages.
 */
export const webExtractTool: typeof extractTool = extractTool;
