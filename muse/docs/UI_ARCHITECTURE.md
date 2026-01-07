# Mythos UI Architecture

## Tech Stack

### Frontend
- **Expo SDK 54** - Universal app framework
- **Expo Router 6** - File-based routing for web, iOS, macOS
- **React 19** / **React Native 0.81** - Latest cross-platform components
- **Reanimated 4** - Animations and gestures
- **@expo/ui** - SwiftUI native components (iOS/macOS)
- **Zustand** - Client state management

### Backend
- **Convex** - Primary backend (see details below)
- **Qdrant** - Vector database (embeddings + reranker)
- **DeepInfra** - Embedding models + reranker inference

### Analytics
- **PostHog** - Self-hosted product analytics, feature flags, session replay

---

## Convex - Unified Backend

Convex replaces Supabase for all backend functionality:

### Why Convex over Supabase?

| Aspect | Convex | Supabase |
|--------|--------|----------|
| **Real-time** | Built-in reactive queries | Requires separate subscriptions |
| **Type Safety** | End-to-end TypeScript | Generated types, less integrated |
| **AI Integration** | Native Vercel AI SDK support | Manual integration |
| **Threads/Chat** | Built-in agent threading | Build from scratch |
| **Offline** | ConvexOfflineProvider | Manual implementation |
| **Permissions** | Function-level, TypeScript | Row-Level Security (SQL) |
| **Serverless** | Automatic scaling | Managed Postgres |

### Convex Services

**Authentication**
- Integrates with Clerk, Auth0, WorkOS, or custom OIDC
- JWT validation at function level
- User identity available in all queries/mutations

**Data Storage**
- Projects, documents (chapters/scenes), entities
- Real-time subscriptions out of the box
- Optimistic updates with conflict resolution

**AI Agents (Vercel AI SDK)**
- Native `@convex-dev/agent` integration
- Streaming text responses
- Tool execution with context
- Automatic token usage tracking

**Threads & Chat**
- Persistent conversation threads per user
- Message history with vector search (RAG)
- Streaming deltas saved incrementally

**Memory System**
- Writer preferences and style patterns
- Canon decisions tracking
- Context retrieval for AI prompts

**Async Notifications**
- Background job processing
- Push notification triggers
- Email/webhook integrations

---

## Qdrant - Vector Search (Separate)

Qdrant remains separate for specialized vector operations:

**Why Keep Qdrant Separate?**
- Optimized for high-volume embedding operations
- Reranker support via DeepInfra
- Self-hosted on Hetzner (existing infrastructure)
- Hybrid search (dense + sparse vectors)

**Qdrant Services**
- Document embeddings (Qwen3-Embedding-8B via DeepInfra)
- Entity embeddings for semantic search
- Memory retrieval with reranking
- Collection: `saga_vectors` (4096 dims)

**DeepInfra Integration**
- Embedding generation
- Reranker inference for improved relevance
- Cost-effective GPU inference

---

## PostHog - Analytics (Self-Hosted)

Self-hosted PostHog for complete data ownership:

**Features**
- Product analytics (events, funnels, retention)
- Session replay for debugging
- Feature flags for gradual rollouts
- A/B testing for UI experiments
- LLM observability for AI agent monitoring

**Integration**
- `posthog-react-native` SDK for Expo
- PostHogProvider in root layout
- Autocapture for navigation events
- Custom events for AI interactions

**Self-Hosting**
- Docker deployment on Hetzner
- Cloudflare Tunnel for access
- Full data ownership and privacy

---

## Expo - Universal App Platform

### @expo/ui (SwiftUI Components)

Native components for Apple platforms:
- Buttons, inputs, lists with native feel
- SF Symbols for icons
- Native sheets and modals
- Haptic feedback support

### Platform Targets

| Platform | Renderer | Notes |
|----------|----------|-------|
| **Web** | react-native-web | Metro bundler, SSR-ready |
| **iOS** | Native (SwiftUI via @expo/ui) | App Store distribution |
| **macOS** | Native (SwiftUI via @expo/ui) | Mac App Store or direct |

### Responsive Design

| Viewport | Sidebar | AI Panel | Navigation |
|----------|---------|----------|------------|
| Mobile (<768px) | Hidden | Hidden | Bottom tabs |
| Tablet (768-1024px) | Collapsible | Hidden | Sidebar |
| Desktop (>1024px) | Full | Sticky/Float | Sidebar |

---

## Project Structure

```
apps/expo/
├── app/                      # Expo Router (file-based)
│   ├── _layout.tsx           # Root: Providers, SafeArea
│   ├── (app)/                # Authenticated routes
│   │   ├── _layout.tsx       # AppShell wrapper
│   │   ├── index.tsx         # Home/Editor
│   │   └── [docId].tsx       # Document view
│   ├── (auth)/               # Auth routes
│   │   ├── login.tsx
│   │   └── signup.tsx
│   └── settings.tsx          # Settings modal
├── src/
│   ├── design-system/        # Tokens, theme, layout store
│   ├── components/
│   │   ├── layout/           # AppShell, Sidebar, AIPanel
│   │   ├── editor/           # Document editor
│   │   ├── entities/         # Entity forms, cards
│   │   └── ai/               # Chat, tool cards
│   ├── providers/            # Convex, PostHog, Auth
│   ├── stores/               # Zustand stores
│   └── hooks/                # Custom hooks
└── convex/                   # Convex functions (if colocated)
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        EXPO APP                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Sidebar │  │ Editor  │  │ AI Chat │  │ Entities│        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       │            │            │            │               │
│       └────────────┴────────────┴────────────┘               │
│                         │                                    │
│                    ┌────┴────┐                               │
│                    │ Zustand │  (UI State)                   │
│                    └────┬────┘                               │
└─────────────────────────┼───────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│    CONVEX     │ │    QDRANT     │ │   POSTHOG     │
│               │ │               │ │               │
│ • Auth        │ │ • Embeddings  │ │ • Analytics   │
│ • Data        │ │ • Reranker    │ │ • Flags       │
│ • AI Agents   │ │ • Hybrid      │ │ • Replay      │
│ • Threads     │ │   Search      │ │ • A/B Tests   │
│ • Memory      │ │               │ │               │
│ • Notifs      │ │ (DeepInfra)   │ │ (Self-hosted) │
└───────────────┘ └───────────────┘ └───────────────┘
```

---

## Phases

### Phase 1: Foundation ✅ COMPLETE
> BD: `muse-i0z` (closed)

- [x] Expo SDK 54 + Router 6 setup
- [x] Design tokens centralized
- [x] Theme hook with light/dark
- [x] AppShell with responsive breakpoints
- [x] Sidebar with project picker
- [x] AI Panel (sticky/floating)
- [x] Web build passing

### Phase 2: MLP UI 🔜 CURRENT
> Focus: Complete UI before backend integration

- [ ] Editor component (placeholder or basic)
- [ ] Entity forms and cards
- [ ] Project switcher modal
- [ ] Chapter/scene tree interactions
- [ ] AI chat message list
- [ ] Tool execution cards
- [ ] Keyboard shortcuts
- [ ] Animations and polish

### Phase 3: Convex Integration
> BD: `muse-j3z` (open, P1)

- [ ] Convex provider setup
- [ ] Auth integration (Clerk or custom OIDC)
- [ ] Data schema (projects, documents, entities)
- [ ] Real-time queries and mutations
- [ ] Offline support (ConvexOfflineProvider)

### Phase 4: AI Agents
> BD: `muse-nnl` (open, P1)

- [ ] @convex-dev/agent setup
- [ ] Vercel AI SDK streaming
- [ ] Thread management
- [ ] Tool definitions (lint, analyze, etc.)
- [ ] Memory retrieval from Qdrant

### Phase 5: Analytics & Flags

- [ ] PostHog self-hosted deployment
- [ ] posthog-react-native integration
- [ ] Event tracking setup
- [ ] Feature flags for gradual rollout
- [ ] LLM observability

### Phase 6: Native Builds
> BD: `muse-z93` (open, P2)

- [ ] iOS build with @expo/ui
- [ ] macOS build
- [ ] App icons and splash
- [ ] TestFlight distribution

---

## Key Decisions

1. **Convex over Supabase** - Better AI integration, real-time, TypeScript
2. **Qdrant stays separate** - Specialized vector ops, reranker support
3. **PostHog self-hosted** - Data ownership, full feature set
4. **Auth via Convex** - Clerk/OIDC integration, not Supabase Auth
5. **Expo for all platforms** - Single codebase, native feel
6. **@expo/ui for native** - SwiftUI components on Apple platforms
7. **UI-first approach** - Polish UI before backend wiring

---

## Infrastructure

| Service | Host | URL |
|---------|------|-----|
| Convex | Convex Cloud | api.cascada.vision |
| Qdrant | Hetzner VPS | qdrant.cascada.vision |
| PostHog | Hetzner VPS | posthog.cascada.vision (planned) |
| Web App | Vercel/Cloudflare | app.cascada.vision |

---

## Related BD Tasks

| ID | Priority | Status | Title |
|----|----------|--------|-------|
| muse-i0z | P0 | ✅ closed | Expo Migration - Foundation Complete |
| muse-j3z | P1 | open | Expo UI - Convex Data Integration |
| muse-nnl | P1 | open | Expo UI - AI Tools Panel |
| muse-z93 | P2 | open | Expo UI - Native Builds (iOS/macOS) |

---

## Commands

```bash
# Development (from monorepo root)
bun run dev:expo          # Start Expo (all platforms)
bun run dev:expo:web      # Start web only

# Development (from apps/expo)
bun run dev               # Interactive (press w/i/a)
bun run dev:web           # Web on port 8082

# Build
bun run build:web         # Export static web

# Native (requires Xcode)
bun run ios               # iOS simulator
bun run macos             # macOS app
```
