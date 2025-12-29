# Mythos IDE — Implementation Plan for Auth, Collaboration, Offline

## Executive Summary

This plan covers three major features:
1. **Authentication** - Supabase Auth with Google/Apple OAuth (web + mobile)
2. **Collaboration** - Real-time multi-user editing with role-based permissions
3. **Offline Mode** - Local-first architecture with background sync

---

## Phase 1: Supabase Client Refactor (Blocking)

### Problem
Current `@mythos/db/client.ts` uses Vite-only `import.meta.env` at module scope, breaking Expo/Metro.

### Solution
Refactor to platform-agnostic initialization:

```typescript
// packages/db/src/client.ts
export type SupabaseInitConfig = {
  url: string;
  anonKey: string;
  storage?: StorageAdapter;
  detectSessionInUrl?: boolean; // true on web, false on native
};

export function initSupabaseClient(config: SupabaseInitConfig): void;
export function getSupabaseClient(): SupabaseClient<Database>;
```

### Files to Modify
- `packages/db/src/client.ts` - Replace module-scope env reads
- `packages/db/src/index.ts` - Update exports
- `apps/web/src/main.tsx` - Add init call
- `apps/mobile/lib/supabase.ts` - New init module

---

## Phase 2: Authentication System

### Database Changes

**Migration: `006_profiles.sql`**
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### Supabase Config Updates

**`supabase/config.toml`**
```toml
[auth]
site_url = "http://localhost:5173"
additional_redirect_urls = [
  "http://localhost:5173/auth/callback",
  "mythos://auth/callback"
]
```

### Web Implementation

**New Files:**
- `apps/web/src/hooks/useSupabaseAuthSync.ts` - Auth state sync
- `apps/web/src/components/auth/AuthScreen.tsx` - Login/signup UI
- `apps/web/src/components/settings/ProfileSettings.tsx` - Profile management

**Modify `apps/web/src/App.tsx`:**
```tsx
function App() {
  const { isLoading, isAuthenticated } = useAuthStore();
  
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <AuthScreen />;
  
  // Existing project selection/editor flow
}
```

### Mobile Implementation

**Dependencies to Add (`apps/mobile/package.json`):**
```json
{
  "dependencies": {
    "expo-auth-session": "~6.0.0",
    "expo-apple-authentication": "~7.0.0",
    "@react-native-community/netinfo": "^11.4.1"
  }
}
```

**New Files:**
- `apps/mobile/lib/supabase.ts` - Supabase init
- `apps/mobile/lib/useSupabaseAuthSync.ts` - Auth sync hook
- `apps/mobile/app/(auth)/sign-in.tsx` - Native sign-in screen

**Google Sign-In (Expo):**
```tsx
import * as Google from "expo-auth-session/providers/google";

const [request, response, promptAsync] = Google.useAuthRequest({
  iosClientId: "YOUR_IOS_CLIENT_ID",
  androidClientId: "YOUR_ANDROID_CLIENT_ID",
});

// On success:
const { id_token } = response.authentication;
await supabase.auth.signInWithIdToken({ provider: "google", token: id_token });
```

**Apple Sign-In (Expo):**
```tsx
import * as AppleAuthentication from "expo-apple-authentication";

const credential = await AppleAuthentication.signInAsync({
  requestedScopes: [
    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
    AppleAuthentication.AppleAuthenticationScope.EMAIL,
  ],
});

await supabase.auth.signInWithIdToken({
  provider: "apple",
  token: credential.identityToken,
});
```

---

## Phase 3: Collaboration Schema + RLS

### Database Changes

**Migration: `007_collaboration.sql`**
```sql
-- Project members table
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE (project_id, user_id)
);

-- Project invitations table
CREATE TABLE project_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
  token UUID DEFAULT gen_random_uuid() UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

-- Activity log table (append-only)
CREATE TABLE activity_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL, -- 'insert', 'update', 'delete'
  entity_table TEXT NOT NULL,
  entity_id UUID NOT NULL,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helper function for RLS
CREATE OR REPLACE FUNCTION is_project_member(p_project_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_project_editor(p_project_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'editor')
  );
$$;

-- Updated RLS policies
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can create projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;

CREATE POLICY "Members can view projects" ON projects
  FOR SELECT USING (is_project_member(id));

CREATE POLICY "Users can create projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Owners can update projects" ON projects
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM project_members WHERE project_id = id AND user_id = auth.uid() AND role = 'owner')
  );

CREATE POLICY "Owners can delete projects" ON projects
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM project_members WHERE project_id = id AND user_id = auth.uid() AND role = 'owner')
  );

-- Invitation acceptance RPC (secure)
CREATE OR REPLACE FUNCTION accept_project_invitation(p_token UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_invitation project_invitations%ROWTYPE;
  v_user_email TEXT;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  
  SELECT * INTO v_invitation FROM project_invitations
  WHERE token = p_token AND accepted_at IS NULL AND expires_at > NOW();
  
  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;
  
  IF v_invitation.email != v_user_email THEN
    RAISE EXCEPTION 'Invitation email does not match';
  END IF;
  
  INSERT INTO project_members (project_id, user_id, role, accepted_at)
  VALUES (v_invitation.project_id, auth.uid(), v_invitation.role, NOW());
  
  UPDATE project_invitations SET accepted_at = NOW() WHERE id = v_invitation.id;
END;
$$;
```

---

## Phase 4: Real-time Collaboration

### Supabase Realtime Channels

```typescript
// packages/state/src/collaboration.ts
export interface CollaboratorPresence {
  id: string;
  name: string;
  avatarUrl?: string;
  color: string;
  cursor?: { from: number; to: number };
  lastSeen: string;
}

export interface CollaborationState {
  members: ProjectMember[];
  presence: CollaboratorPresence[];
  activity: ActivityLogEntry[];
  myRole: ProjectRole | null;
  isReadOnly: boolean;
}

// Channel design
// project:{projectId} - presence for "online in project"
// doc:{projectId}:{documentId} - cursors + document sync
// db:{projectId} - postgres_changes for entities/relationships/documents
```

### Collaboration Client

```typescript
// packages/sync/src/collaborationClient.ts
export class CollaborationClient {
  constructor(private supabase: TypedSupabaseClient) {}

  async connectProject(projectId: string) {
    const channel = this.supabase.channel(`project:${projectId}`);
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        // Update collaboration store
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        filter: `project_id=eq.${projectId}`
      }, (payload) => {
        // Handle DB changes
      })
      .subscribe();
  }

  async connectDocument(projectId: string, documentId: string) {
    const channel = this.supabase.channel(`doc:${projectId}:${documentId}`);
    
    return {
      trackCursor: (cursor: { from: number; to: number }) => {
        channel.track({ cursor, userId: currentUserId });
      },
      onPresence: (cb) => {
        channel.on('presence', { event: 'sync' }, () => cb(channel.presenceState()));
      },
      broadcast: (event, payload) => channel.send({ type: 'broadcast', event, payload }),
      onBroadcast: (event, cb) => channel.on('broadcast', { event }, cb),
    };
  }
}
```

### UI Components

**New Files:**
- `apps/web/src/components/collaboration/CollaboratorsBar.tsx`
- `apps/web/src/components/collaboration/ActivityFeed.tsx`
- `apps/web/src/components/modals/InviteMemberModal.tsx`

---

## Phase 5: Offline Mode

### New Package: `@mythos/sync`

**Structure:**
```
packages/sync/
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── syncEngine.ts
│   ├── web/
│   │   └── dexieDb.ts
│   └── native/
│       └── sqliteDb.ts
├── package.json
└── tsconfig.json
```

### Local Database Schema (Dexie/SQLite)

```typescript
// packages/sync/src/types.ts
export interface LocalDbAdapter {
  // Bootstrap
  bootstrapProject(projectId: string, snapshot: ProjectSnapshot): Promise<void>;
  
  // Activity sync
  applyActivity(events: ActivityLogEntry[]): Promise<void>;
  getLastActivityCursor(projectId: string): Promise<number | null>;
  setLastActivityCursor(projectId: string, cursor: number): Promise<void>;
  
  // Outbox (pending mutations)
  enqueueMutation(m: Mutation): Promise<void>;
  peekMutations(limit: number): Promise<Mutation[]>;
  markMutationDone(id: string): Promise<void>;
  markMutationFailed(id: string, reason: string): Promise<void>;
  
  // AI queue
  enqueueAiRequest(req: QueuedAiRequest): Promise<void>;
  peekAiRequests(limit: number): Promise<QueuedAiRequest[]>;
  markAiRequestDone(id: string): Promise<void>;
}

export type Mutation = {
  id: string;
  table: 'documents' | 'entities' | 'relationships';
  type: 'upsert' | 'delete';
  row?: any;
  pk?: string;
  baseVersion?: number;
  createdAt: string;
};
```

### Sync Engine

```typescript
// packages/sync/src/syncEngine.ts
export class SyncEngine {
  constructor(private deps: {
    supabase: TypedSupabaseClient;
    local: LocalDbAdapter;
    projectId: string;
    isOnline: () => boolean;
  }) {}

  async start() {
    // Load from local DB into Zustand stores
    // If online, begin incremental pull
    // Subscribe to realtime changes
  }

  async syncNow(): Promise<{ pushed: number; pulled: number }> {
    if (!this.deps.isOnline()) return { pushed: 0, pulled: 0 };
    
    // Push: Apply outbox mutations to Supabase
    // Pull: Fetch activity_log after last cursor
    // Process: Apply to local DB and stores
  }

  async mutate(m: Mutation) {
    // Apply locally immediately (optimistic)
    await this.deps.local.enqueueMutation(m);
    // Update Zustand stores
    // Trigger sync if online
  }

  async queueAi(req: QueuedAiRequest) {
    await this.deps.local.enqueueAiRequest(req);
    // Process immediately if online
  }
}
```

### Versioning for Conflict Prevention

**Migration: `008_offline_versioning.sql`**
```sql
ALTER TABLE documents ADD COLUMN version INT DEFAULT 1;
ALTER TABLE entities ADD COLUMN version INT DEFAULT 1;
ALTER TABLE relationships ADD COLUMN version INT DEFAULT 1;

-- Auto-increment version on update
CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_version BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION increment_version();

CREATE TRIGGER entities_version BEFORE UPDATE ON entities
  FOR EACH ROW EXECUTE FUNCTION increment_version();

CREATE TRIGGER relationships_version BEFORE UPDATE ON relationships
  FOR EACH ROW EXECUTE FUNCTION increment_version();
```

### Offline Status State

```typescript
// packages/state/src/offline.ts
export interface OfflineState {
  isOnline: boolean;
  lastSyncAt: string | null;
  pendingMutations: number;
  pendingAiRequests: number;
  syncError: string | null;
}

export function createOfflineStore(deps: {
  netInfo: () => boolean;
  syncEngine: SyncEngine;
}) {
  return create<OfflineState>()((set) => ({
    isOnline: true,
    lastSyncAt: null,
    pendingMutations: 0,
    pendingAiRequests: 0,
    syncError: null,
    // ... actions
  }));
}
```

---

## File Summary

### New Migrations
1. `006_profiles.sql` - User profiles table
2. `007_collaboration.sql` - Members, invitations, activity log, RLS
3. `008_offline_versioning.sql` - Version columns for conflict prevention

### New Package
- `packages/sync/` - Sync engine, local DB adapters, offline queue

### New Files by App

**Web (`apps/web/src/`):**
- `hooks/useSupabaseAuthSync.ts`
- `hooks/useOnlineStatus.ts`
- `hooks/useCollaboration.ts`
- `components/auth/AuthScreen.tsx`
- `components/settings/ProfileSettings.tsx`
- `components/collaboration/CollaboratorsBar.tsx`
- `components/collaboration/ActivityFeed.tsx`
- `components/modals/InviteMemberModal.tsx`

**Mobile (`apps/mobile/`):**
- `lib/supabase.ts`
- `lib/useSupabaseAuthSync.ts`
- `lib/useOnlineStatus.ts`
- `app/(auth)/sign-in.tsx`

### Modified Files
- `packages/db/src/client.ts` - Platform-agnostic init
- `packages/db/src/index.ts` - Updated exports
- `packages/state/src/auth.ts` - Enhanced actions
- `packages/state/src/project.ts` - CRUD actions for sync
- `apps/web/src/main.tsx` - Supabase init
- `apps/web/src/App.tsx` - Auth gate
- `apps/mobile/app/_layout.tsx` - Auth gate
- `supabase/config.toml` - Redirect URLs

---

## Implementation Order

1. **Week 1-2**: Supabase client refactor + Authentication
2. **Week 3**: Collaboration schema + RLS
3. **Week 4**: Real-time collaboration MVP
4. **Week 5-6**: Offline mode + sync engine
5. **Week 7+**: Polish, CRDT text collaboration (optional)

---

## Dependencies to Add

**Web (`apps/web/package.json`):**
```json
{
  "@supabase/auth-ui-react": "^0.4.7",
  "@supabase/auth-ui-shared": "^0.1.8",
  "dexie": "^4.0.8",
  "yjs": "^13.6.18" // Optional for CRDT
}
```

**Mobile (`apps/mobile/package.json`):**
```json
{
  "expo-auth-session": "~6.0.0",
  "expo-apple-authentication": "~7.0.0",
  "@react-native-community/netinfo": "^11.4.1",
  "expo-sqlite": "~15.0.0"
}
```
