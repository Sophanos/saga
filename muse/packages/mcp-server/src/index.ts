#!/usr/bin/env node
/**
 * Saga MCP Server
 *
 * Model Context Protocol server that exposes Saga's worldbuilding tools
 * to external AI clients like Claude Desktop, Cursor, and other MCP clients.
 *
 * Usage:
 *   saga-mcp                           # Uses environment variables
 *   SUPABASE_URL=... SAGA_API_KEY=... saga-mcp
 *
 * Environment Variables:
 *   SUPABASE_URL   - Supabase project URL
 *   SAGA_API_KEY   - Saga/Supabase API key (anon key or service role key)
 *
 * @packageDocumentation
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { SAGA_TOOLS, TOOL_MAP } from "./tools.js";
import {
  RESOURCE_TEMPLATES,
  fetchResource,
} from "./resources.js";
import { SAGA_PROMPTS, PROMPT_MAP, getPromptMessages } from "./prompts.js";
import type { SagaApiConfig } from "./types.js";

// =============================================================================
// Configuration
// =============================================================================

const SERVER_NAME = "saga-worldbuilding";
const SERVER_VERSION = "1.0.0";

/**
 * Gets the API configuration from environment variables.
 */
function getApiConfig(): SagaApiConfig {
  const supabaseUrl = process.env.SUPABASE_URL;
  const apiKey = process.env.SAGA_API_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    console.error("[saga-mcp] SUPABASE_URL environment variable is required");
    process.exit(1);
  }

  if (!apiKey) {
    console.error(
      "[saga-mcp] SAGA_API_KEY or SUPABASE_ANON_KEY environment variable is required"
    );
    process.exit(1);
  }

  return { supabaseUrl, apiKey };
}

// =============================================================================
// Tool Execution
// =============================================================================

/**
 * Executes a tool by calling the Saga API.
 */
async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  config: SagaApiConfig
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  console.error(`[saga-mcp] Executing tool: ${toolName}`);

  try {
    // Call the Saga edge function
    const response = await fetch(`${config.supabaseUrl}/functions/v1/ai-saga`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        apikey: config.apiKey,
      },
      body: JSON.stringify({
        kind: "execute_tool",
        toolName,
        input: args,
        projectId: args.projectId as string | undefined,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[saga-mcp] API error (${response.status}):`, errorText);

      return {
        content: [
          {
            type: "text",
            text: `Error executing ${toolName}: ${response.status} ${response.statusText}\n${errorText}`,
          },
        ],
        isError: true,
      };
    }

    const result = await response.json();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    console.error(`[saga-mcp] Tool execution error:`, error);

    return {
      content: [
        {
          type: "text",
          text: `Error executing ${toolName}: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Executes a resource search tool locally.
 */
async function executeSearchTool(
  args: Record<string, unknown>,
  config: SagaApiConfig
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  const projectId = args.projectId as string;
  const query = args.query as string;

  if (!projectId || !query) {
    return {
      content: [
        {
          type: "text",
          text: "Error: projectId and query are required for search_entities",
        },
      ],
      isError: true,
    };
  }

  try {
    // Use Supabase full-text search
    const response = await fetch(
      `${config.supabaseUrl}/rest/v1/entities?project_id=eq.${projectId}&or=(name.ilike.*${encodeURIComponent(query)}*,notes.ilike.*${encodeURIComponent(query)}*)&limit=${args.limit || 10}`,
      {
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status} ${response.statusText}`);
    }

    const entities = await response.json() as Array<Record<string, unknown>>;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              query,
              projectId,
              results: entities,
              count: entities.length,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    console.error(`[saga-mcp] Search error:`, error);

    return {
      content: [
        {
          type: "text",
          text: `Error searching entities: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

// =============================================================================
// Server Setup
// =============================================================================

/**
 * Creates and configures the MCP server.
 */
function createServer(config: SagaApiConfig): Server {
  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  // ---------------------------------------------------------------------------
  // Tools Handlers
  // ---------------------------------------------------------------------------

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.error("[saga-mcp] Listing tools");
    return { tools: SAGA_TOOLS };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    console.error(`[saga-mcp] Tool call: ${name}`);

    // Validate tool exists
    if (!TOOL_MAP.has(name)) {
      return {
        content: [
          {
            type: "text",
            text: `Unknown tool: ${name}. Available tools: ${Array.from(TOOL_MAP.keys()).join(", ")}`,
          },
        ],
        isError: true,
      };
    }

    // Handle search_entities locally
    if (name === "search_entities") {
      return executeSearchTool(args as Record<string, unknown>, config);
    }

    // Execute tool via Saga API
    return executeTool(name, args as Record<string, unknown>, config);
  });

  // ---------------------------------------------------------------------------
  // Resources Handlers
  // ---------------------------------------------------------------------------

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    console.error("[saga-mcp] Listing resource templates");
    return { resourceTemplates: RESOURCE_TEMPLATES };
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    console.error("[saga-mcp] Listing resources");

    // Return base resources (projects list)
    // Full resource discovery requires a project context
    return {
      resources: [
        {
          uri: "saga://projects",
          name: "Projects",
          description: "List of worldbuilding projects",
          mimeType: "application/json",
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    console.error(`[saga-mcp] Reading resource: ${uri}`);

    const resource = await fetchResource(uri, config);

    if (!resource) {
      throw new Error(`Resource not found: ${uri}`);
    }

    return {
      contents: [
        {
          uri: resource.uri,
          mimeType: resource.mimeType || "application/json",
          text: resource.text || "",
        },
      ],
    };
  });

  // ---------------------------------------------------------------------------
  // Prompts Handlers
  // ---------------------------------------------------------------------------

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    console.error("[saga-mcp] Listing prompts");
    return { prompts: SAGA_PROMPTS };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    console.error(`[saga-mcp] Getting prompt: ${name}`);

    const prompt = PROMPT_MAP.get(name);
    if (!prompt) {
      throw new Error(
        `Unknown prompt: ${name}. Available prompts: ${Array.from(PROMPT_MAP.keys()).join(", ")}`
      );
    }

    // Validate required arguments
    for (const arg of prompt.arguments || []) {
      if (arg.required && !args[arg.name]) {
        throw new Error(`Missing required argument: ${arg.name}`);
      }
    }

    const messages = getPromptMessages(name, args as Record<string, string>);

    return {
      description: prompt.description,
      messages,
    };
  });

  // ---------------------------------------------------------------------------
  // Error Handling
  // ---------------------------------------------------------------------------

  server.onerror = (error) => {
    console.error("[saga-mcp] Server error:", error);
  };

  return server;
}

// =============================================================================
// Main Entry Point
// =============================================================================

async function main(): Promise<void> {
  console.error("[saga-mcp] Starting Saga MCP Server...");

  // Get configuration
  const config = getApiConfig();
  console.error(`[saga-mcp] Configured with Supabase URL: ${config.supabaseUrl}`);

  // Create server
  const server = createServer(config);

  // Create transport
  const transport = new StdioServerTransport();

  // Connect and run
  console.error("[saga-mcp] Connecting via stdio transport...");
  await server.connect(transport);
  console.error("[saga-mcp] Server running. Waiting for requests...");

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.error("[saga-mcp] Shutting down...");
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.error("[saga-mcp] Shutting down...");
    await server.close();
    process.exit(0);
  });
}

// Run the server
main().catch((error) => {
  console.error("[saga-mcp] Fatal error:", error);
  process.exit(1);
});
