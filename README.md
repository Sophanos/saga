# Mythos IDE

An AI-powered creative writing environment for fiction authors that treats **story as code**.

## Overview

Mythos IDE tracks narrative entities (characters, locations, items, magic systems, factions) like programming variables, with a **Project Graph** maintaining relationships and detecting logical inconsistencies. AI agents provide real-time writing feedback including consistency checking, prose quality analysis, and style coaching.

## Features

- **Entity System** - Track characters, locations, items, magic systems, factions, and events with rich metadata
- **Project Graph** - Relationship tracking with conflict detection (genealogy, timeline, contradictions)
- **Writer/DM Mode** - Toggle between narrative focus and mechanical/stats view
- **AI Writing Coach** - Tension analysis, sensory heatmap, show-don't-tell scoring, style feedback
- **Consistency Linter** - AI-powered narrative consistency checking with auto-fix suggestions
- **Rich Text Editor** - Tiptap-based editor with entity mentions (@autocomplete)

## Tech Stack

| Category | Technology |
|----------|------------|
| Runtime | Bun |
| Build | Turborepo |
| Language | TypeScript |
| Frontend | React + Vite |
| Editor | Tiptap (ProseMirror) |
| State | Zustand + Immer |
| Styling | Tailwind CSS |
| UI | Radix UI |
| Database | Supabase (PostgreSQL + pgvector) |
| AI | Vercel AI SDK, OpenRouter, Google Gemini |

## Project Structure

```
muse/
├── apps/
│   └── web/                  # React SPA
├── packages/
│   ├── ai/                   # AI agents (Linter, Coach, Detector)
│   ├── core/                 # Domain types, Project Graph, schemas
│   ├── db/                   # Supabase client, queries, migrations
│   ├── editor/               # Tiptap extensions
│   └── ui/                   # Shared UI components
├── supabase/
│   └── functions/            # Edge Functions (AI endpoints)
└── tooling/                  # Shared configs (ESLint, Tailwind, TypeScript)
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) >= 1.1.38
- [Supabase](https://supabase.com/) account (for database)
- [OpenRouter](https://openrouter.ai/) API key (for AI features)

### Installation

```bash
# Clone the repository
git clone https://github.com/Sophanos/saga.git
cd saga/muse

# Install dependencies
bun install

# Copy environment variables
cp .env.example .env
# Edit .env with your API keys
```

### Environment Variables

```bash
# Supabase (required)
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# OpenRouter - Primary AI provider (required)
OPENROUTER_API_KEY=your-openrouter-api-key

# Google Gemini - Fallback AI provider (optional)
GOOGLE_GENERATIVE_AI_API_KEY=your-google-ai-api-key
```

### Development

```bash
# Start development server
bun run dev

# Run only the web app
bun run --filter @mythos/web dev

# Type checking
bun run typecheck

# Linting
bun run lint

# Build all packages
bun run build
```

The web app runs on `http://localhost:3000`.

## License

Private - All rights reserved.
