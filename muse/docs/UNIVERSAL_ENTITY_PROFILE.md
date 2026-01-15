# Universal Entity Profile Page

> Last updated: 2026-01-14

## Purpose

One UI pattern for any entity type (characters, people, companies, products, segments). The Project Type Registry defines fields and schemas — this page is the visual surface.

## Decision: Hybrid Layout

Structured header + editor body + tabs.

- **Header**: Icon, name, type, key fields as pills, relationship badges, actions dropdown
- **Tabs**: Overview, Graph, Mentions, History
- **Body**: TipTap editor with inline `/commands` — the entity's document

Writers get flexibility. Other domains can toggle to panel-first via template.

## Data Sources

| Tab | Source |
|-----|--------|
| Overview | Entity fields + freeform editor + assets |
| Graph | Relationships (Convex), centered on this entity |
| Mentions | Qdrant semantic search (docs, chat, embeddings, image assets) |
| History | Knowledge PRs + change log |

## Widgets

Widgets are inline `/commands` that work with entity context:
- `/generate name` — name generator (fictional only)
- `/expand backstory` — expands content
- `/suggest-connections` — proposes relationships
- `/add-voice` — assigns voice profile (for audiobooks)
- `/analyze image` — extracts visual details into entity notes

Widgets can produce:
- **Inline output** — updates the entity/document
- **New artifact** — creates manga page, audiobook, presentation

## Identity Sensitivity

| Entity Type | Name Changes | Content Generation |
|-------------|--------------|-------------------|
| Fictional (character) | ✓ allowed | ✓ allowed |
| Real (contact, company) | ✗ blocked or approval | ✓ allowed for notes |

Registry defines `fictional: true/false` per type.

## Multi-Modal Properties

Entities can hold any modality:
- Text (name, backstory)
- Image (portrait, concept art)
- Audio (voice profile, theme music)
- Reference (links to artifacts)

Images are stored as `projectAssets` and referenced by `assetId`/`storageId` in entity context.
Widgets declare their modality. Agents route to the right service.

## Create/Update Flow (Nodes vs Entities)

`node` and `entity` targets are treated the same in graph mutations:
- The `graph_mutation` tool accepts `target: "entity" | "node"`.
- Both map to the same underlying entity records; `node` is a legacy alias.
- Identity changes (name/type) follow approval gating rules in `approvalConfig.ts`.

Practically: the Universal Entity Profile page is the UI surface for both.

## Implementation

- Reuse TipTap editor with entity context passed in
- Fields rendered from `projectTypeRegistry` schema
- `/widget` commands already exist — add entity awareness
- Graph/Mentions/History as tabs below header
- Assets render from `projectAssets` and resolve URLs via storage

## Related

- `projectTypeRegistry` — types and schemas
- `docs/MLP1_ROADMAP.md` line 98
