# Graph API Contract

Last updated: 2026-01-11

This document is the source of truth for Project Graph writes and validation.

## Registry

### Registry Resolution

- `projectTypeRegistry.getResolved(projectId) -> { entityTypes, relationshipTypes }`
- Resolution merges project overrides with writer defaults (registry is authoritative for writes).

### Registry Locking

- `projectTypeRegistry.lock(projectId) -> { locked: true, revision }`
- `projectTypeRegistry.unlock(projectId) -> { locked: false, revision }`

Lock semantics:
- When locked, registry mutations (`upsert`, `resetToDefaults`) are blocked.
- Locking verifies the current graph is compatible with the registry.
- Unlocking requires owner-level permission.

Lock readiness checks:
- All existing `entities.type` must exist in the resolved registry.
- All existing `relationships.type` must exist in the resolved registry.

Registry errors:
- `REGISTRY_LOCKED`
- `LOCK_FAILED_UNKNOWN_TYPES`
- `INVALID_REGISTRY`

## Entities

### API

- `entities.create(...) -> Id<"entities">`
- `entities.update(...) -> Id<"entities">`
- `entities.remove(...) -> Id<"entities">`
- `entities.bulkCreate(...) -> Id<"entities">[]`

### Validation Rules

For every entity create/update:
1. `type` must exist in the resolved registry.
2. `properties` must validate against the registry JSON Schema (if present).

Entity error codes:
- `INVALID_TYPE`
- `SCHEMA_VALIDATION_FAILED`
- `ACCESS_DENIED`

## Relationships

### API

- `relationships.create(...) -> Id<"relationships">`
- `relationships.update(...) -> Id<"relationships">`
- `relationships.remove(...) -> Id<"relationships">`
- `relationships.bulkCreate(...) -> Id<"relationships">[]`

### Validation Rules

For every relationship create/update:
1. `type` must exist in the resolved registry.
2. `metadata` must validate against the registry JSON Schema (if present).

Relationship error codes:
- `INVALID_TYPE`
- `SCHEMA_VALIDATION_FAILED`
- `ACCESS_DENIED`

## JSON Schema Expectations

- Draft: 2020-12
- Entity `schema` validates `entity.properties` (object).
- Relationship `schema` validates `relationship.metadata` (object).
- Unknown keys are rejected when the schema sets `additionalProperties: false`.

Example (entity schema):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "archetype": { "type": "string" },
    "goals": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["name"],
  "additionalProperties": false
}
```

Example (relationship schema):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "reason": { "type": "string" },
    "certainty": { "type": "number", "minimum": 0, "maximum": 1 }
  },
  "required": ["reason"],
  "additionalProperties": false
}
```

## Validation Engine

- JSON Schema validation is powered by Ajv.
- Configuration is reject-only: no automatic normalization, no stripping, no default insertion.

## World Graph Tool Error Payloads

Handlers in `muse/convex/ai/tools/worldGraphHandlers.ts` return:

```ts
{ success: true; message: string; entityId?: string; relationshipId?: string }
```

Or, on error:

```ts
{ success: false; code: "INVALID_TYPE" | "SCHEMA_VALIDATION_FAILED" | "ACCESS_DENIED" | "NOT_FOUND" | "CONFLICT"; message: string; details?: unknown }
```

## Approval Gating

World graph tool approvals are driven by registry `riskLevel`:
- `low`: auto-execute, except identity changes that remain PR-gated.
- `high`: create/update requires Knowledge PR.
- `core`: always requires Knowledge PR.

Identity-sensitive fields remain governed by `IDENTITY_SENSITIVE_FIELDS`.
