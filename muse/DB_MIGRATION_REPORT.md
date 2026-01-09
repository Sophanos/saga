# @mythos/db Migration Report
Generated: 2026-01-09T15:04:01.464Z

## Summary
- Total files with @mythos/db imports: 13
- Total imports to migrate: 24

## Files by Priority

### High Priority (Hooks - need Convex hooks)
- `apps/web/src/hooks/useAutoSave.ts` (1 imports)
- `apps/web/src/hooks/useEntityPersistence.ts` (1 imports)
- `apps/web/src/hooks/useMentionPersistence.ts` (1 imports)

### Medium Priority (Components)
- `apps/web/src/components/canvas/Canvas.tsx` (2 imports)
- `apps/web/src/components/collaboration/InviteAcceptPage.tsx` (2 imports)
- `apps/web/src/components/editor/SceneListBlock.tsx` (3 imports)
- `apps/web/src/components/modals/ProjectCreateModal.tsx` (4 imports)
- `apps/web/src/components/modals/TemplatePickerModal/CreateProjectForm.tsx` (2 imports)
- `apps/web/src/components/projects/ProjectPickerSidebar.tsx` (2 imports)

### Low Priority (Services/Utils)
- `apps/web/src/services/ai/sagaClient.ts` (2 imports)
- `apps/web/src/services/analysis/analysisRepository.ts` (2 imports)
- `apps/web/src/services/projects/seedWorldbuilding.ts` (1 imports)

### Other
- `apps/mobile/lib/useProgressiveSync.ts` (1 imports)

## Detailed Migration Guide

### `apps/web/src/hooks/useAutoSave.ts`

**Current imports:**
```typescript
// Line 3
import { updateDocument } from "@mythos/db";
```

**Migration steps:**

- `updateDocument` → `useMutation(api.documents.update)`

### `apps/web/src/hooks/useEntityPersistence.ts`

**Current imports:**
```typescript
// Line 11
import type { Database } from "@mythos/db";
```

**Migration steps:**

- `Database` → **MANUAL REVIEW REQUIRED**
  - Use types from convex/_generated/dataModel instead

### `apps/web/src/hooks/useMentionPersistence.ts`

**Current imports:**
```typescript
// Line 8
import type { Database } from "@mythos/db";
```

**Migration steps:**

- `Database` → **MANUAL REVIEW REQUIRED**
  - Use types from convex/_generated/dataModel instead

### `apps/mobile/lib/useProgressiveSync.ts`

**Current imports:**
```typescript
// Line 10
import { type DbProgressiveProjectState } from "@mythos/db";
```

**Migration steps:**

- `DbProgressiveProjectState` → **MANUAL REVIEW REQUIRED**
  - Define locally or import from @mythos/core

### `apps/web/src/components/canvas/Canvas.tsx`

**Current imports:**
```typescript
// Line 23
import { createDocument, mapDbDocumentToDocument } from "@mythos/db";
```

**Migration steps:**

- `createDocument` → `useMutation(api.documents.create)`
- `mapDbDocumentToDocument` → **REMOVE**
  - Remove - Convex returns proper types directly

### `apps/web/src/components/collaboration/InviteAcceptPage.tsx`

**Current imports:**
```typescript
// Line 3
import { acceptInvitation, getInvitationByToken } from "@mythos/db";
```

**Migration steps:**

- `acceptInvitation` → `useMutation(api.collaboration.acceptInvite)`
- `getInvitationByToken` → `useQuery(api.collaboration.getInviteByToken, { token })`

### `apps/web/src/components/editor/SceneListBlock.tsx`

**Current imports:**
```typescript
// Line 5
import { createDocument, deleteDocument, mapDbDocumentToDocument } from "@mythos/db";
```

**Migration steps:**

- `createDocument` → `useMutation(api.documents.create)`
- `deleteDocument` → `useMutation(api.documents.remove)`
- `mapDbDocumentToDocument` → **REMOVE**
  - Remove - Convex returns proper types directly

### `apps/web/src/components/modals/ProjectCreateModal.tsx`

**Current imports:**
```typescript
// Line 16
import { createProject, createDocument, createEntity, createRelationship } from "@mythos/db";
```

**Migration steps:**

- `createProject` → `useMutation(api.projects.create)`
  - Note: Use useMutation from convex/react
- `createDocument` → `useMutation(api.documents.create)`
- `createEntity` → `useMutation(api.entities.create)`
- `createRelationship` → `useMutation(api.relationships.create)`

### `apps/web/src/components/modals/TemplatePickerModal/CreateProjectForm.tsx`

**Current imports:**
```typescript
// Line 4
import { createProject, createDocument } from "@mythos/db";
```

**Migration steps:**

- `createProject` → `useMutation(api.projects.create)`
  - Note: Use useMutation from convex/react
- `createDocument` → `useMutation(api.documents.create)`

### `apps/web/src/components/projects/ProjectPickerSidebar.tsx`

**Current imports:**
```typescript
// Line 13
import { createDocument, mapDbDocumentToDocument } from "@mythos/db";
```

**Migration steps:**

- `createDocument` → `useMutation(api.documents.create)`
- `mapDbDocumentToDocument` → **REMOVE**
  - Remove - Convex returns proper types directly

### `apps/web/src/services/ai/sagaClient.ts`

**Current imports:**
```typescript
// Line 11
import { getSupabaseClient, isSupabaseInitialized } from "@mythos/db";
```

**Migration steps:**

- `getSupabaseClient` → **MANUAL REVIEW REQUIRED**
  - REMOVE - Use Convex client from ConvexProvider context
- `isSupabaseInitialized` → **MANUAL REVIEW REQUIRED**
  - REMOVE - Convex is always available via provider

### `apps/web/src/services/analysis/analysisRepository.ts`

**Current imports:**
```typescript
// Line 1
import { getSupabaseClient, type Database } from "@mythos/db";
```

**Migration steps:**

- `getSupabaseClient` → **MANUAL REVIEW REQUIRED**
  - REMOVE - Use Convex client from ConvexProvider context
- `Database` → **MANUAL REVIEW REQUIRED**
  - Use types from convex/_generated/dataModel instead

### `apps/web/src/services/projects/seedWorldbuilding.ts`

**Current imports:**
```typescript
// Line 1
import { createDocument } from "@mythos/db";
```

**Migration steps:**

- `createDocument` → `useMutation(api.documents.create)`

## Convex Import Template

Add these imports to replace @mythos/db:

```typescript
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id, Doc } from "../../../../convex/_generated/dataModel";
```

## Common Patterns

### Before (Supabase)
```typescript
import { createDocument, getDocument } from "@" + "mythos/db";

// Usage
const doc = await createDocument({ title: "My Doc", projectId });
```

### After (Convex)
```typescript
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

// In component
const createDocument = useMutation(api.documents.create);
const document = useQuery(api.documents.get, { id: documentId });

// Usage
await createDocument({ title: "My Doc", projectId });
```
