# MLP 1: AI Co-Author Roadmap

## Vision

Mythos = **AI co-author** for fiction writers. Notion-like editor + Cursor-style AI assistance.

- Auto-extracts entities, relationships, world from writing
- Adapts to writer's style via embeddings
- Real-time feedback (show-don't-tell, pacing, dialogue)
- Offline-first with cloud sync

---

## Platform Priority

| Priority | Platform | Stack | Status |
|----------|----------|-------|--------|
| 1 | **Web** | Expo Web | Primary development |
| 2 | **macOS** | Tauri + WebView | Desktop wrapper |
| 3 | iOS/iPad | Expo RN | Future |

**Strategy:** Build once in Expo Web → wrap in Tauri for native macOS → same codebase for mobile.

---

## Infrastructure

| Service | Purpose |
|---------|---------|
| Convex | Real-time DB, offline sync, AI agent runtime |
| Qdrant | Vector search (embeddings, RAG) |
| DeepInfra | Embeddings + reranker |
| RevenueCat | Subscriptions (App Store IAP) |

All self-hosted on Hetzner (EU data sovereignty).

---

## Phases

### Phase 1: Foundation ✅
- Expo SDK 54 + Router 6
- Design system (tokens, theme)
- AppShell with resizable panels
- AI Panel with Muse avatar

### Phase 2: Editor Core (Current)
- TipTap editor bundle (`@mythos/editor-webview`)
- Bridge protocol (WebView ↔ Native)
- Suggestion system (diff-first editing)
- Tauri macOS app scaffold

### Phase 3: Tauri Integration
- [ ] Load Expo Web in Tauri WebView (replace current React app)
- [ ] Native menus, shortcuts, file dialogs
- [ ] Auto-update system
- [ ] Code signing for distribution

### Phase 4: AI Agent
- Convex agent runtime with tools
- RAG pipeline (Qdrant + reranker)
- Per-thread conversation persistence
- Style adaptation via embeddings

### Phase 5: Collaboration
- Real-time presence (cursors, selections)
- Conflict resolution (CRDTs)
- Comment threads
- Share/publish flow

### Phase 6: Mobile
- Expo iOS/iPad build
- Touch-optimized editor
- Offline queue sync

---

## Tauri ← Expo Web Convergence

Current Tauri app has placeholder React components. Goal: replace with Expo Web.

**Step 1:** Point Tauri WebView to Expo Web dev server
- Change `devUrl` from Vite to Expo Web (`localhost:8082`)
- Test all features work in WebView context

**Step 2:** Replace components incrementally
- Sidebar → Expo Web sidebar
- Editor → Already shared (`@mythos/editor-webview`)
- AI Panel → Expo Web AI panel

**Step 3:** Production bundle
- Expo Web export → Tauri resources
- Single build artifact for both platforms

**Step 4:** Native enhancements
- macOS menu bar integration
- Keyboard shortcuts (Cmd+S, etc.)
- Native file picker for imports
- Touch Bar support (optional)

---

## Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Editor | TipTap (ProseMirror) | Extensible, diff-first AI editing |
| State | Zustand | Simple, works everywhere |
| Backend | Convex | Offline-first, real-time, self-hostable |
| AI | @convex-dev/agent | Native tool calls, thread persistence |
| Desktop | Tauri v2 | 5MB vs Electron 150MB |
| Payments | RevenueCat | Required for App Store |

---

## Non-Goals (MLP 1)

- Android app
- Windows/Linux builds
- Team workspaces
- Plugin marketplace
- Version history UI
