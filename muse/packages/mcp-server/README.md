# Saga MCP Server

MCP (Model Context Protocol) server that exposes Saga's worldbuilding tools to external AI clients like Claude Desktop, Cursor, and other MCP-compatible applications.

## Overview

This server allows writers to use Saga's powerful worldbuilding capabilities directly from their favorite AI assistant. Create characters, check narrative consistency, generate names, and more - all without leaving Claude Desktop or Cursor.

## Features

### Tools

The server exposes the following worldbuilding tools:

| Tool | Description |
|------|-------------|
| `create_entity` | Create characters, locations, items, factions, magic systems, events, or concepts |
| `update_entity` | Update existing entity properties |
| `create_relationship` | Create relationships between entities (knows, loves, parent_of, etc.) |
| `search_entities` | Semantic search for entities in your project |
| `generate_content` | Generate descriptions, backstories, dialogue, or scenes |
| `genesis_world` | Generate a complete world scaffold from a concept |
| `generate_template` | Create an AI-generated project template for your genre |
| `detect_entities` | Extract entities from narrative text |
| `check_consistency` | Find contradictions, plot holes, and timeline errors |
| `clarity_check` | Analyze prose for readability and clarity issues |
| `check_logic` | Validate magic rules, causality, and power scaling |
| `name_generator` | Generate culturally-appropriate names |

### Resources

Access your Saga project data via resources:

| Resource URI | Description |
|--------------|-------------|
| `saga://projects` | List all projects |
| `saga://projects/{id}` | Project details with entity counts |
| `saga://projects/{id}/entities` | All entities in a project |
| `saga://projects/{id}/entities/{entityId}` | Entity details with relationships |
| `saga://projects/{id}/relationships` | All relationships (project graph) |
| `saga://projects/{id}/documents` | All documents in a project |
| `saga://projects/{id}/documents/{docId}` | Document content |
| `saga://projects/{id}/graph` | Project graph in visualization format |

### Prompts

Pre-built workflow prompts for common tasks:

| Prompt | Description |
|--------|-------------|
| `worldbuilding-session` | Guided worldbuilding with focus areas |
| `character-development` | Deep dive into a specific character |
| `consistency-review` | Review narrative for issues |
| `world-genesis` | Create a complete world from concept |
| `magic-system-design` | Design consistent magic rules |
| `writing-coach` | Get feedback on your prose |
| `naming-brainstorm` | Generate names for entities |
| `relationship-mapping` | Explore entity connections |
| `scene-planning` | Plan a scene beat by beat |
| `entity-detection` | Find entities in text |

## Installation

### Option 1: From npm (when published)

```bash
npm install -g @mythos/mcp-server
```

### Option 2: From source

```bash
# Clone the repository
git clone https://github.com/your-org/saga.git
cd saga/muse

# Install dependencies
bun install

# Build the MCP server
cd packages/mcp-server
bun run build
```

## Configuration

### Environment Variables

Create a `.env` file or set these environment variables:

```bash
# Required: Your Supabase project URL
SUPABASE_URL=https://your-project.supabase.co

# Required: API key (use anon key for client-side access)
SAGA_API_KEY=your_supabase_anon_key

# Alternative: You can also use SUPABASE_ANON_KEY
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Getting Your API Keys

1. Log in to your Saga/Mythos account
2. Go to Settings > API Keys
3. Copy the Supabase URL and anon key

Or if you have direct Supabase access:
1. Go to [supabase.com](https://supabase.com) and open your project
2. Navigate to Settings > API
3. Copy the Project URL and anon key

## Adding to Claude Desktop

1. Open Claude Desktop settings
2. Navigate to the MCP section
3. Add a new server with this configuration:

```json
{
  "mcpServers": {
    "saga": {
      "command": "saga-mcp",
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SAGA_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

Or if running from source:

```json
{
  "mcpServers": {
    "saga": {
      "command": "node",
      "args": ["/path/to/saga/muse/packages/mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SAGA_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

4. Restart Claude Desktop

## Adding to Cursor

1. Open Cursor settings (Cmd/Ctrl + ,)
2. Search for "MCP" or navigate to Extensions > MCP
3. Add the server configuration:

```json
{
  "saga": {
    "command": "saga-mcp",
    "env": {
      "SUPABASE_URL": "https://your-project.supabase.co",
      "SAGA_API_KEY": "your_api_key_here"
    }
  }
}
```

## Usage Examples

### Creating a Character

```
Use the create_entity tool to create a new character named "Elena Blackwood"
who is a mysterious scholar with a hidden past. She should have the archetype
of a mentor figure, with goals to uncover ancient secrets and fears of
repeating past mistakes.
```

### Generating a World

```
Use genesis_world to create a dark fantasy world based on this concept:
"A kingdom where magic is powered by memories - the more precious the memory
sacrificed, the more powerful the spell. The royal family guards the last
remaining memories of the world before The Forgetting."
```

### Checking Consistency

```
Use check_consistency to review my latest chapter for any contradictions
or plot holes, focusing on character behavior and timeline.
```

### Generating Names

```
Use name_generator to create 10 character names with Norse cultural
inspiration for a dark fantasy setting. Avoid names that sound too
similar to Ragnar or Bjorn.
```

### Starting a Worldbuilding Session

```
Let's start a worldbuilding-session for my project. I want to focus on
developing the faction system - I have some basic factions but they feel
flat and need more depth.
```

## Development

### Running Locally

```bash
# Install dependencies
bun install

# Run in development mode (with hot reload)
bun run dev

# Build for production
bun run build

# Run the built server
bun run start
```

### Testing

You can test the server using the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector saga-mcp
```

Or use the Claude Desktop debug mode to see MCP communication.

### Project Structure

```
muse/packages/mcp-server/
├── src/
│   ├── index.ts      # Main MCP server entry point
│   ├── tools.ts      # Tool definitions
│   ├── resources.ts  # Resource providers
│   ├── prompts.ts    # Pre-built workflow prompts
│   └── types.ts      # TypeScript type definitions
├── package.json
├── tsconfig.json
└── README.md
```

## Troubleshooting

### Server Not Starting

1. Check that environment variables are set correctly
2. Verify your API key is valid
3. Check Claude Desktop logs for error messages

### Tools Not Working

1. Ensure you have access to the project you're trying to modify
2. Check that the Saga API is accessible from your network
3. Verify your API key has the necessary permissions

### Connection Issues

1. The server uses stdio transport - ensure no other process is competing for stdin/stdout
2. Check firewall settings if API calls are failing
3. Verify the Supabase URL is correct and accessible

## API Reference

### Tool Schemas

All tools accept JSON input matching their schema. See the tool definitions in `src/tools.ts` for complete schemas.

### Error Handling

Tools return errors in this format:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Error executing tool_name: error message"
    }
  ],
  "isError": true
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- GitHub Issues: [Report a bug](https://github.com/your-org/saga/issues)
- Documentation: [Saga Docs](https://docs.saga.dev)
- Discord: [Join our community](https://discord.gg/saga)
