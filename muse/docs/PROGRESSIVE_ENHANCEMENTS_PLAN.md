# Progressive Structure System - Pending Enhancements

## Implementation Plan for Phase 2 Features

This document outlines the detailed implementation plan for 5 pending enhancements to the Progressive Structure System.

---

## Enhancement 1: State Persistence (localStorage + DB Sync)

### Overview
Persist progressive state across browser sessions and eventually sync to database for cross-device continuity.

### Requirements
1. Use `zustand/persist` middleware with custom storage adapter
2. Persist only durable keys (exclude ephemeral data like `pendingDetectedEntities`)
3. Use `@mythos/storage` for platform abstraction (web/native)
4. Add DB schema for server-side persistence (future sync)

### Files to Modify/Create

#### 1. `packages/state/src/progressive.ts`
**Location**: Store creation (line ~380)

**Changes**:
```typescript
import { persist, createJSONStorage } from "zustand/middleware";
import { createStorageAdapter } from "@mythos/storage";

// Add persistence configuration
const PERSIST_CONFIG = {
  name: "mythos-progressive-state",
  version: 1,
  partialize: (state: ProgressiveState) => ({
    // Persist only durable keys
    archetype: state.archetype,
    archetypeSelectedAt: state.archetypeSelectedAt,
    onboardingCompletedAt: state.onboardingCompletedAt,
    completedOnboardingSteps: state.completedOnboardingSteps,
    projects: Object.fromEntries(
      Object.entries(state.projects).map(([id, proj]) => [
        id,
        {
          creationMode: proj.creationMode,
          phase: proj.phase,
          unlockedModules: proj.unlockedModules,
          totalWritingTimeSec: proj.totalWritingTimeSec,
          neverAsk: proj.neverAsk,
          lastEntityNudgeAtWordCount: proj.lastEntityNudgeAtWordCount,
          // Exclude: entityMentionCounts, entityNudgeSnoozedUntil (ephemeral)
        },
      ])
    ),
    milestones: state.milestones,
    uiVisibility: state.uiVisibility,
  }),
  migrate: (persistedState: unknown, version: number) => {
    // Handle version migrations
    if (version === 0) {
      return { ...persistedState, version: 1 };
    }
    return persistedState as ProgressiveState;
  },
};

// Wrap store creation with persist middleware
export const useProgressiveStore = create<ProgressiveState>()(
  persist(
    immer((set) => ({
      // ... existing implementation
    })),
    {
      ...PERSIST_CONFIG,
      storage: createJSONStorage(() => createStorageAdapter()),
    }
  )
);
```

#### 2. `packages/storage/src/web.ts`
**Location**: Existing file

**Changes**: Ensure `createStorageAdapter()` returns a zustand-compatible storage interface:
```typescript
export function createStorageAdapter(): StateStorage {
  return {
    getItem: (name: string) => {
      const value = localStorage.getItem(name);
      return value ? JSON.parse(value) : null;
    },
    setItem: (name: string, value: unknown) => {
      localStorage.setItem(name, JSON.stringify(value));
    },
    removeItem: (name: string) => {
      localStorage.removeItem(name);
    },
  };
}
```

#### 3. `packages/storage/src/native.ts`
**Location**: Existing file

**Changes**: Add AsyncStorage adapter for React Native:
```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";

export function createStorageAdapter(): StateStorage {
  return {
    getItem: async (name: string) => {
      const value = await AsyncStorage.getItem(name);
      return value ? JSON.parse(value) : null;
    },
    setItem: async (name: string, value: unknown) => {
      await AsyncStorage.setItem(name, JSON.stringify(value));
    },
    removeItem: async (name: string) => {
      await AsyncStorage.removeItem(name);
    },
  };
}
```

#### 4. `packages/db/src/migrations/011_progressive_state.sql` (NEW)
**Purpose**: DB schema for server-side sync (Phase 2)

```sql
-- Progressive state per project
CREATE TABLE IF NOT EXISTS project_progressive_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creation_mode TEXT NOT NULL CHECK (creation_mode IN ('architect', 'gardener', 'hybrid')),
  phase INTEGER NOT NULL DEFAULT 1 CHECK (phase BETWEEN 1 AND 4),
  unlocked_modules JSONB NOT NULL DEFAULT '{"editor": true}',
  total_writing_time_sec INTEGER NOT NULL DEFAULT 0,
  never_ask JSONB NOT NULL DEFAULT '{}',
  last_entity_nudge_word_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- User-level progressive preferences
CREATE TABLE IF NOT EXISTS user_progressive_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  archetype TEXT CHECK (archetype IN ('architect', 'gardener', 'hybrid')),
  archetype_selected_at TIMESTAMPTZ,
  onboarding_completed_at TIMESTAMPTZ,
  completed_onboarding_steps TEXT[] NOT NULL DEFAULT '{}',
  ui_visibility JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_project_progressive_state_project ON project_progressive_state(project_id);
CREATE INDEX idx_project_progressive_state_user ON project_progressive_state(user_id);

-- RLS policies
ALTER TABLE project_progressive_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progressive_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own progressive state"
  ON project_progressive_state FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own preferences"
  ON user_progressive_preferences FOR ALL
  USING (auth.uid() = user_id);
```

#### 5. `packages/db/src/queries/progressive.ts` (NEW)
**Purpose**: CRUD operations for progressive state sync

```typescript
import { supabase } from "../client";

export interface DbProgressiveProjectState {
  id: string;
  project_id: string;
  user_id: string;
  creation_mode: "architect" | "gardener" | "hybrid";
  phase: number;
  unlocked_modules: Record<string, boolean>;
  total_writing_time_sec: number;
  never_ask: Record<string, boolean>;
  last_entity_nudge_word_count: number | null;
  created_at: string;
  updated_at: string;
}

export async function getProjectProgressiveState(
  projectId: string
): Promise<DbProgressiveProjectState | null> {
  const { data, error } = await supabase
    .from("project_progressive_state")
    .select("*")
    .eq("project_id", projectId)
    .single();

  if (error) throw error;
  return data;
}

export async function upsertProjectProgressiveState(
  projectId: string,
  state: Partial<Omit<DbProgressiveProjectState, "id" | "project_id" | "user_id" | "created_at" | "updated_at">>
): Promise<DbProgressiveProjectState> {
  const { data, error } = await supabase
    .from("project_progressive_state")
    .upsert({
      project_id: projectId,
      ...state,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Similar functions for user preferences...
```

### Side Effects
- First load after upgrade will start fresh (no migration from non-persisted state)
- localStorage quota (~5MB) should be monitored for large project counts
- DB sync requires authenticated user; local-only fallback for anonymous users

---

## Enhancement 2: Writing Time Tracking with Idle Detection

### Overview
Track actual writing time (excluding idle periods) for usage-based feature unlock suggestions.

### Requirements
1. Track keystrokes/edits to detect active writing
2. Use idle threshold (30s) to pause counting
3. Persist accumulated time per project
4. Surface time in UI for user awareness

### Files to Modify

#### 1. `apps/web/src/components/progressive/ProgressiveStructureController.tsx`
**Location**: Lines 160-195 (existing writing time tracking)

**Changes**: Enhance idle detection with more accurate activity tracking:
```typescript
// Constants
const WRITING_TIME_INTERVAL = 5000; // 5 seconds
const IDLE_THRESHOLD = 30000; // 30 seconds
const ACTIVITY_DEBOUNCE = 1000; // 1 second

// Enhanced activity tracking
const lastActivityRef = useRef<number>(Date.now());
const isActiveRef = useRef<boolean>(false);

// Track multiple activity signals
useEffect(() => {
  if (!editorInstance) return;

  const editor = editorInstance as Editor;
  
  const markActive = () => {
    lastActivityRef.current = Date.now();
    isActiveRef.current = true;
  };

  // Subscribe to multiple activity events
  editor.on("update", markActive);
  editor.on("selectionUpdate", markActive);
  
  // Also track keyboard events on the editor element
  const editorElement = editor.view?.dom;
  if (editorElement) {
    editorElement.addEventListener("keydown", markActive);
    editorElement.addEventListener("mousedown", markActive);
  }

  return () => {
    editor.off("update", markActive);
    editor.off("selectionUpdate", markActive);
    if (editorElement) {
      editorElement.removeEventListener("keydown", markActive);
      editorElement.removeEventListener("mousedown", markActive);
    }
  };
}, [editorInstance]);

// Interval-based time accumulation
useEffect(() => {
  if (!projectId) return;

  const interval = setInterval(() => {
    const now = Date.now();
    const timeSinceActivity = now - lastActivityRef.current;

    if (timeSinceActivity < IDLE_THRESHOLD && isActiveRef.current) {
      // User was active in this interval
      addWritingTime(projectId, WRITING_TIME_INTERVAL / 1000);
    }
    
    // Reset active flag - will be set again by next activity
    if (timeSinceActivity >= IDLE_THRESHOLD) {
      isActiveRef.current = false;
    }
  }, WRITING_TIME_INTERVAL);

  return () => clearInterval(interval);
}, [projectId, addWritingTime]);
```

#### 2. `apps/web/src/components/Header.tsx`
**Location**: Add writing time display

**Changes**: Show accumulated writing time in header:
```typescript
import { useActiveTotalWritingTime, useIsGardenerMode } from "@mythos/state";
import { Clock } from "lucide-react";

// Inside component
const writingTimeSec = useActiveTotalWritingTime();
const isGardener = useIsGardenerMode();

// Format time helper
const formatWritingTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

// In JSX (show only in gardener mode)
{isGardener && writingTimeSec > 0 && (
  <div className="flex items-center gap-1.5 text-xs text-mythos-text-muted">
    <Clock className="w-3.5 h-3.5" />
    <span>{formatWritingTime(writingTimeSec)}</span>
  </div>
)}
```

### Side Effects
- Slightly more CPU usage from additional event listeners
- Time tracking pauses when browser tab is inactive (desired behavior)

---

## Enhancement 3: Linter Integration for Phase 2→3 Transition

### Overview
Wire the ConsistencyLinter agent to automatically trigger Phase 2→3 transition when contradictions are detected.

### Requirements
1. Run linter periodically or on document save
2. Parse linter results for `isContradiction` or `severity === "error"`
3. Trigger phase transition and show consistency nudge
4. Support cross-document linting (concatenate docs)

### Files to Modify/Create

#### 1. `apps/web/src/hooks/useLinterFixes.ts`
**Location**: Existing file - add progressive integration

**Changes**:
```typescript
import { useProgressiveStore, useIsGardenerMode, useActivePhase } from "@mythos/state";

// Inside the hook
const isGardener = useIsGardenerMode();
const phase = useActivePhase();
const { setPhase, showNudge } = useProgressiveStore.getState();

// After receiving linter results
const handleLinterResults = useCallback((issues: LinterIssue[]) => {
  setIssues(issues);
  
  // Progressive phase transition: Phase 2 → 3 on first inconsistency
  if (isGardener && phase === 2) {
    const hasContradiction = issues.some(
      (issue) => issue.isContradiction || 
                 (issue.severity === "error" && issue.relatedLocations?.length > 0)
    );
    
    if (hasContradiction) {
      const projectId = useProgressiveStore.getState().activeProjectId;
      if (projectId) {
        // Transition to Phase 3
        setPhase(projectId, 3);
        
        // Show consistency nudge for the first issue
        const firstContradiction = issues.find(
          (i) => i.isContradiction || i.severity === "error"
        );
        
        if (firstContradiction) {
          showNudge({
            id: `${projectId}:consistency_choice:${firstContradiction.id}`,
            projectId,
            type: "consistency_choice",
            createdAt: new Date().toISOString(),
            issueId: firstContradiction.id,
            summary: firstContradiction.message,
          });
        }
      }
    }
  }
}, [isGardener, phase, setPhase, showNudge]);
```

#### 2. `apps/web/src/hooks/useProgressiveLinter.ts` (NEW)
**Purpose**: Orchestrate linter runs for progressive disclosure

```typescript
import { useEffect, useRef, useCallback } from "react";
import { useMythosStore } from "../stores";
import { 
  useProgressiveStore, 
  useIsGardenerMode, 
  useActivePhase,
  useActiveProjectId,
  type ConsistencyChoiceNudge,
} from "@mythos/state";
import { runLinterViaEdge } from "../services/ai";

const LINTER_DEBOUNCE_MS = 10000; // 10 seconds after last edit
const MIN_WORD_COUNT_FOR_LINT = 300;

export function useProgressiveLinter() {
  const projectId = useActiveProjectId();
  const isGardener = useIsGardenerMode();
  const phase = useActivePhase();
  
  const documents = useMythosStore((s) => Array.from(s.document.documents.values()));
  const entities = useMythosStore((s) => Array.from(s.world.entities.values()));
  
  const lastLintRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { setPhase, showNudge, unlockModule } = useProgressiveStore.getState();

  const runLint = useCallback(async () => {
    if (!projectId || !isGardener || phase !== 2) return;
    
    // Concatenate all document text for cross-doc analysis
    const combinedText = documents
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .map((doc, i) => `--- ${doc.title || `Document ${i + 1}`} ---\n${doc.contentText || ""}`)
      .join("\n\n");

    if (combinedText.split(/\s+/).length < MIN_WORD_COUNT_FOR_LINT) return;

    try {
      const result = await runLinterViaEdge({
        text: combinedText,
        entities: entities.map((e) => ({
          id: e.id,
          name: e.name,
          type: e.type,
          aliases: e.aliases,
          properties: e.properties,
        })),
        options: { includeCanonChoices: true },
      });

      // Check for contradictions
      const contradictions = result.issues.filter(
        (issue) => issue.isContradiction || 
                   (issue.severity === "error" && issue.canonChoices?.length > 0)
      );

      if (contradictions.length > 0) {
        // Transition to Phase 3
        setPhase(projectId, 3);
        unlockModule(projectId, "console");

        // Show nudge for first contradiction
        const first = contradictions[0];
        const nudge: ConsistencyChoiceNudge = {
          id: `${projectId}:consistency:${first.id}`,
          projectId,
          type: "consistency_choice",
          createdAt: new Date().toISOString(),
          issueId: first.id,
          summary: first.message,
        };
        showNudge(nudge);
      }

      lastLintRef.current = Date.now();
    } catch (error) {
      console.error("[useProgressiveLinter] Lint failed:", error);
    }
  }, [projectId, isGardener, phase, documents, entities, setPhase, showNudge, unlockModule]);

  // Debounced linting on document changes
  useEffect(() => {
    if (!isGardener || phase !== 2) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      runLint();
    }, LINTER_DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [documents, isGardener, phase, runLint]);

  return { runLint };
}
```

#### 3. `packages/prompts/src/linter.ts`
**Location**: Extend prompt for canon choices

**Changes**: Add instructions for generating `canonChoices`:
```typescript
// Add to CONSISTENCY_LINTER_SYSTEM
const CANON_CHOICE_INSTRUCTIONS = `
When detecting contradictions, provide resolution options:

For each contradiction issue, include:
- isContradiction: true
- canonQuestion: A clear question asking which version is correct
- canonChoices: Array of 2-4 options, each with:
  - id: Unique identifier (e.g., "choice_1")
  - label: Short description (e.g., "Marcus got his scar in childhood")
  - explanation: Why this choice makes sense
  - entityName: Name of entity to update (if applicable)
  - propertyKey: Property to set (if applicable)
  - value: Value to set (if applicable)
- evidence: Array of text excerpts showing the contradiction

Example canonChoices:
[
  {
    "id": "childhood_scar",
    "label": "Scar from childhood accident",
    "explanation": "Matches the flashback scene in Chapter 2",
    "entityName": "Marcus",
    "propertyKey": "scarOrigin",
    "value": "childhood accident"
  },
  {
    "id": "battle_scar",
    "label": "Scar from the Battle of Thornwood",
    "explanation": "Adds dramatic weight to the battle's significance",
    "entityName": "Marcus",
    "propertyKey": "scarOrigin",
    "value": "Battle of Thornwood"
  }
]
`;
```

#### 4. `apps/web/src/components/Layout.tsx`
**Location**: Mount the progressive linter hook

**Changes**:
```typescript
import { useProgressiveLinter } from "../hooks/useProgressiveLinter";

export function Layout() {
  // ... existing code
  
  // Progressive linter for Phase 2→3 transition
  useProgressiveLinter();
  
  // ... rest of component
}
```

### Side Effects
- Increased API calls for linting (throttled to 10s debounce)
- Cross-document linting may hit token limits for very long projects
- Consider adding a "Run Linter" manual trigger for user control

---

## Enhancement 4: Command Palette Gating

### Overview
Prevent keyboard shortcuts and command palette commands from accessing locked modules.

### Requirements
1. Filter command palette items based on unlocked modules
2. Disable keyboard shortcuts for locked features
3. Show "locked" indicator with unlock hint

### Files to Modify

#### 1. `apps/web/src/commands/navigation-commands.ts`
**Location**: Command definitions

**Changes**: Add `requiredModule` metadata to commands:
```typescript
import type { UIModuleId } from "@mythos/state";

export interface Command {
  id: string;
  name: string;
  shortcut?: string;
  action: () => void;
  category?: string;
  requiredModule?: UIModuleId; // NEW: Gate by progressive unlock
}

export const navigationCommands: Command[] = [
  {
    id: "toggle-manifest",
    name: "Toggle Manifest Panel",
    shortcut: "Cmd+Shift+M",
    category: "Navigation",
    requiredModule: "manifest", // Requires manifest unlock
    action: () => { /* ... */ },
  },
  {
    id: "toggle-console",
    name: "Toggle Console Panel",
    shortcut: "Cmd+Shift+C",
    category: "Navigation",
    requiredModule: "console", // Requires console unlock
    action: () => { /* ... */ },
  },
  {
    id: "open-world-graph",
    name: "Open World Graph",
    shortcut: "Cmd+Shift+G",
    category: "Navigation",
    requiredModule: "world_graph", // Requires world_graph unlock
    action: () => { /* ... */ },
  },
  // ... other commands
];
```

#### 2. `apps/web/src/commands/registry.ts`
**Location**: Command registry

**Changes**: Filter commands by unlock status:
```typescript
import { useProgressiveStore, useIsGardenerMode } from "@mythos/state";

export function useAvailableCommands(): Command[] {
  const allCommands = useAllCommands();
  const isGardener = useIsGardenerMode();
  
  if (!isGardener) {
    // Architect mode: all commands available
    return allCommands;
  }

  const activeProjectId = useProgressiveStore((s) => s.activeProjectId);
  const projectState = useProgressiveStore((s) => 
    activeProjectId ? s.projects[activeProjectId] : null
  );

  return allCommands.filter((cmd) => {
    if (!cmd.requiredModule) return true;
    return projectState?.unlockedModules[cmd.requiredModule] === true;
  });
}

// For displaying locked commands with hint
export function useCommandsWithLockStatus(): Array<Command & { isLocked: boolean; unlockHint?: string }> {
  const allCommands = useAllCommands();
  const isGardener = useIsGardenerMode();
  
  if (!isGardener) {
    return allCommands.map((cmd) => ({ ...cmd, isLocked: false }));
  }

  const activeProjectId = useProgressiveStore((s) => s.activeProjectId);
  const projectState = useProgressiveStore((s) => 
    activeProjectId ? s.projects[activeProjectId] : null
  );

  return allCommands.map((cmd) => {
    if (!cmd.requiredModule) {
      return { ...cmd, isLocked: false };
    }
    
    const isUnlocked = projectState?.unlockedModules[cmd.requiredModule] === true;
    return {
      ...cmd,
      isLocked: !isUnlocked,
      unlockHint: !isUnlocked ? getUnlockHint(cmd.requiredModule) : undefined,
    };
  });
}

function getUnlockHint(module: UIModuleId): string {
  switch (module) {
    case "manifest":
      return "Track entities in your story to unlock";
    case "console":
      return "Resolve a consistency issue to unlock";
    case "world_graph":
      return "Add 5+ characters to unlock";
    default:
      return "Keep writing to unlock";
  }
}
```

#### 3. `apps/web/src/components/command-palette/CommandPalette.tsx`
**Location**: Command rendering

**Changes**: Show locked state in UI:
```typescript
import { useCommandsWithLockStatus } from "../../commands/registry";
import { Lock } from "lucide-react";

// Inside component
const commands = useCommandsWithLockStatus();

// In render
{commands.map((cmd) => (
  <CommandItem
    key={cmd.id}
    command={cmd}
    isLocked={cmd.isLocked}
    onSelect={() => {
      if (cmd.isLocked) {
        // Show toast with unlock hint
        toast.info(cmd.unlockHint);
        return;
      }
      cmd.action();
      closeCommandPalette();
    }}
  />
))}
```

#### 4. `apps/web/src/components/command-palette/CommandItem.tsx`
**Location**: Individual command rendering

**Changes**: Visual locked state:
```typescript
interface CommandItemProps {
  command: Command;
  isLocked?: boolean;
  onSelect: () => void;
}

export function CommandItem({ command, isLocked, onSelect }: CommandItemProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-md",
        isLocked
          ? "opacity-50 cursor-not-allowed"
          : "hover:bg-mythos-bg-tertiary"
      )}
    >
      <span className="flex-1 text-left">{command.name}</span>
      {isLocked && <Lock className="w-3.5 h-3.5 text-mythos-text-muted" />}
      {!isLocked && command.shortcut && (
        <kbd className="text-xs text-mythos-text-muted">{command.shortcut}</kbd>
      )}
    </button>
  );
}
```

#### 5. `apps/web/src/hooks/useGlobalShortcuts.ts`
**Location**: Keyboard shortcut handler

**Changes**: Check unlock status before executing:
```typescript
import { useProgressiveStore, useIsGardenerMode } from "@mythos/state";

export function useGlobalShortcuts() {
  const isGardener = useIsGardenerMode();
  const activeProjectId = useProgressiveStore((s) => s.activeProjectId);
  const unlockedModules = useProgressiveStore((s) => 
    activeProjectId ? s.projects[activeProjectId]?.unlockedModules : null
  );

  const isModuleUnlocked = useCallback((module: UIModuleId): boolean => {
    if (!isGardener) return true;
    return unlockedModules?.[module] === true;
  }, [isGardener, unlockedModules]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ... existing shortcut detection
      
      // Check if shortcut requires locked module
      const command = getCommandByShortcut(shortcutKey);
      if (command?.requiredModule && !isModuleUnlocked(command.requiredModule)) {
        e.preventDefault();
        toast.info(getUnlockHint(command.requiredModule));
        return;
      }
      
      // ... execute command
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModuleUnlocked]);
}
```

### Side Effects
- Commands array is re-filtered on progressive state changes
- Memoize filtered commands to avoid unnecessary re-renders

---

## Enhancement 5: Genesis Wizard Edge Function (Architect Mode)

### Overview
Enable Architect mode scaffolding via AI-powered genesis that creates initial world structure from a prompt.

### Requirements
1. Edge function for genesis generation
2. Client service for calling genesis
3. Integration with ProjectCreateModal for Architect flow
4. Create starter entities and optionally a document outline

### Files to Create/Modify

#### 1. `supabase/functions/ai-genesis/index.ts` (NEW)
**Purpose**: Edge function for world generation

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getApiKey } from "../_shared/api-key.ts";
import { createOpenRouterProvider } from "../_shared/providers.ts";
import { GENESIS_SYSTEM_PROMPT, GENESIS_USER_PROMPT } from "../_shared/prompts/mod.ts";

interface GenesisRequest {
  prompt: string;
  genre?: string;
  preferences?: {
    entityCount?: number;
    includeOutline?: boolean;
    detailLevel?: "minimal" | "standard" | "detailed";
  };
}

interface GeneratedEntity {
  name: string;
  type: "character" | "location" | "item" | "faction" | "magic_system" | "creature";
  description: string;
  properties?: Record<string, string | number | boolean>;
  relationships?: Array<{ targetName: string; type: string; description?: string }>;
}

interface GenesisResponse {
  entities: GeneratedEntity[];
  worldSummary: string;
  suggestedTitle?: string;
  outline?: Array<{ title: string; summary: string }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, genre, preferences }: GenesisRequest = await req.json();
    const apiKey = await getApiKey(req);
    
    const provider = createOpenRouterProvider(apiKey);
    
    const systemPrompt = GENESIS_SYSTEM_PROMPT
      .replace("{{genre}}", genre || "fantasy")
      .replace("{{entityCount}}", String(preferences?.entityCount || 10))
      .replace("{{detailLevel}}", preferences?.detailLevel || "standard");
    
    const userPrompt = GENESIS_USER_PROMPT
      .replace("{{prompt}}", prompt)
      .replace("{{includeOutline}}", String(preferences?.includeOutline ?? true));

    const response = await provider.generateObject({
      model: "anthropic/claude-3.5-sonnet",
      system: systemPrompt,
      prompt: userPrompt,
      schema: genesisResponseSchema, // Zod schema
    });

    return new Response(JSON.stringify(response.object), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[ai-genesis] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

#### 2. `supabase/functions/_shared/prompts/genesis.ts` (NEW)
**Purpose**: Genesis prompt templates

```typescript
export const GENESIS_SYSTEM_PROMPT = `You are a world-building assistant for fiction writers.

Genre: {{genre}}
Target entity count: {{entityCount}}
Detail level: {{detailLevel}}

Your task is to generate a coherent world structure based on the user's prompt. Create:
1. Characters with distinct personalities, roles, and relationships
2. Locations that serve the story's needs
3. Items of significance (magical artifacts, technology, etc.)
4. Factions or organizations if relevant
5. Magic systems or special rules if applicable

Ensure all entities are interconnected through relationships.
Output should be immediately usable in a story bible.`;

export const GENESIS_USER_PROMPT = `Create a world based on this concept:

{{prompt}}

${{{includeOutline}} ? "Also generate a 3-5 chapter outline for the story." : ""}

Generate entities and relationships that would support this narrative.`;
```

#### 3. `apps/web/src/services/ai/genesisClient.ts` (NEW)
**Purpose**: Client for calling genesis edge function

```typescript
import { callEdgeFunction, ApiError } from "../api-client";

export class GenesisApiError extends ApiError {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "GenesisApiError";
  }
}

export interface GenesisRequestPayload {
  prompt: string;
  genre?: string;
  preferences?: {
    entityCount?: number;
    includeOutline?: boolean;
    detailLevel?: "minimal" | "standard" | "detailed";
  };
}

export interface GeneratedEntity {
  name: string;
  type: "character" | "location" | "item" | "faction" | "magic_system" | "creature";
  description: string;
  properties?: Record<string, string | number | boolean>;
  relationships?: Array<{ targetName: string; type: string; description?: string }>;
}

export interface GenesisResponsePayload {
  entities: GeneratedEntity[];
  worldSummary: string;
  suggestedTitle?: string;
  outline?: Array<{ title: string; summary: string }>;
}

export async function runGenesisViaEdge(
  payload: GenesisRequestPayload,
  options?: { apiKey?: string; signal?: AbortSignal }
): Promise<GenesisResponsePayload> {
  return callEdgeFunction<GenesisRequestPayload, GenesisResponsePayload>(
    "ai-genesis",
    payload,
    {
      apiKey: options?.apiKey,
      signal: options?.signal,
      errorClass: GenesisApiError,
    }
  );
}
```

#### 4. `apps/web/src/services/ai/index.ts`
**Location**: Export genesis client

**Changes**:
```typescript
export { runGenesisViaEdge, GenesisApiError } from "./genesisClient";
export type { GenesisRequestPayload, GenesisResponsePayload, GeneratedEntity } from "./genesisClient";
```

#### 5. `apps/web/src/components/modals/ProjectCreateModal.tsx`
**Location**: Architect mode flow (after line ~130)

**Changes**: Add genesis generation on architect mode submit:
```typescript
import { runGenesisViaEdge, type GeneratedEntity } from "../../services/ai";
import { createEntity, createRelationship } from "@mythos/db";

// Add genesis prompt field for architect mode
interface ProjectFormData {
  name: string;
  description: string;
  genre: Genre | "";
  creationMode: CreationMode;
  genesisPrompt: string; // NEW
}

// In form state
const [isGenerating, setIsGenerating] = useState(false);

// Modified handleSubmit
const handleSubmit = useCallback(async (e: React.FormEvent) => {
  e.preventDefault();
  if (!validate() || isSubmitting) return;

  setIsSubmitting(true);

  try {
    // Create the project
    const project = await createProject({
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      genre: formData.genre || null,
    });

    // Create initial document
    await createDocument({
      project_id: project.id,
      type: "chapter",
      title: "Chapter 1",
      content: EMPTY_TIPTAP_DOC,
      content_text: "",
      order_index: 0,
      word_count: 0,
    });

    // Initialize progressive state
    const progressive = useProgressiveStore.getState();
    progressive.ensureProject(project.id, {
      creationMode: formData.creationMode,
      phase: formData.creationMode === "gardener" ? 1 : 4,
      entityMentionCounts: {},
      unlockedModules: formData.creationMode === "gardener"
        ? { editor: true }
        : { editor: true, manifest: true, console: true, world_graph: true },
      totalWritingTimeSec: 0,
      neverAsk: {},
    });

    // Architect mode: Run genesis if prompt provided
    if (formData.creationMode === "architect" && formData.genesisPrompt.trim()) {
      setIsGenerating(true);
      try {
        const genesis = await runGenesisViaEdge({
          prompt: formData.genesisPrompt,
          genre: formData.genre || undefined,
          preferences: {
            entityCount: 10,
            includeOutline: true,
            detailLevel: "standard",
          },
        });

        // Create entities from genesis result
        const entityIdMap = new Map<string, string>();
        
        for (const genEntity of genesis.entities) {
          const entity = await createEntity({
            project_id: project.id,
            name: genEntity.name,
            type: genEntity.type,
            description: genEntity.description,
            properties: genEntity.properties || {},
            aliases: [],
          });
          entityIdMap.set(genEntity.name, entity.id);
        }

        // Create relationships
        for (const genEntity of genesis.entities) {
          if (!genEntity.relationships) continue;
          
          const sourceId = entityIdMap.get(genEntity.name);
          if (!sourceId) continue;

          for (const rel of genEntity.relationships) {
            const targetId = entityIdMap.get(rel.targetName);
            if (!targetId) continue;

            await createRelationship({
              project_id: project.id,
              source_id: sourceId,
              target_id: targetId,
              type: rel.type,
              properties: rel.description ? { description: rel.description } : {},
            });
          }
        }

        // Create outline documents if provided
        if (genesis.outline) {
          for (let i = 0; i < genesis.outline.length; i++) {
            const chapter = genesis.outline[i];
            await createDocument({
              project_id: project.id,
              type: "chapter",
              title: chapter.title,
              content: {
                type: "doc",
                content: [
                  { type: "paragraph", content: [{ type: "text", text: `// ${chapter.summary}` }] },
                ],
              },
              content_text: `// ${chapter.summary}`,
              order_index: i + 1, // After the initial chapter
              word_count: chapter.summary.split(/\s+/).length,
            });
          }
        }
      } catch (genesisError) {
        console.error("Genesis failed, continuing with empty project:", genesisError);
        // Don't fail project creation if genesis fails
      } finally {
        setIsGenerating(false);
      }
    }

    progressive.setActiveProject(project.id);
    onCreated(project.id);
  } catch (error) {
    // ... error handling
  }
}, [formData, validate, isSubmitting, onCreated]);

// Add genesis prompt textarea for architect mode
{formData.creationMode === "architect" && (
  <FormField label="World Concept" hint="Describe your world and AI will generate initial structure">
    <TextArea
      value={formData.genesisPrompt}
      onChange={(v) => updateFormData({ genesisPrompt: v })}
      placeholder="A dystopian city where emotions are illegal and the protagonist discovers they can feel..."
      rows={4}
      disabled={isSubmitting || isGenerating}
    />
  </FormField>
)}

// Update submit button state
<Button type="submit" disabled={isSubmitting || isGenerating}>
  {isGenerating ? (
    <>
      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      Generating World...
    </>
  ) : isSubmitting ? (
    <>
      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      Creating...
    </>
  ) : (
    <>
      <FolderPlus className="w-4 h-4" />
      Create Project
    </>
  )}
</Button>
```

### Side Effects
- Genesis API call can take 10-30 seconds; show clear loading state
- If genesis fails, project is still created (graceful degradation)
- Consider adding a "Skip" button during generation
- API costs: Claude 3.5 Sonnet call (~$0.01-0.03 per genesis)

---

## Enhancement 6: Mobile Parity (React Native)

### Overview
Port progressive disclosure system to the mobile app for consistent experience.

### Requirements
1. Share `@mythos/state` progressive store with React Native
2. Implement mobile-specific UI for nudges
3. Sync progressive state with web via DB

### Files to Create/Modify

#### 1. `apps/mobile/lib/useProgressiveSync.ts` (NEW)
**Purpose**: Sync progressive state from DB on mobile

```typescript
import { useEffect } from "react";
import { useProgressiveStore } from "@mythos/state";
import { supabase } from "./supabase";

export function useProgressiveSync(projectId: string | null) {
  const { ensureProject, setActiveProject } = useProgressiveStore.getState();

  useEffect(() => {
    if (!projectId) return;

    const loadProgressiveState = async () => {
      try {
        const { data, error } = await supabase
          .from("project_progressive_state")
          .select("*")
          .eq("project_id", projectId)
          .single();

        if (error && error.code !== "PGRST116") {
          throw error;
        }

        if (data) {
          ensureProject(projectId, {
            creationMode: data.creation_mode,
            phase: data.phase,
            unlockedModules: data.unlocked_modules,
            totalWritingTimeSec: data.total_writing_time_sec,
            neverAsk: data.never_ask,
          });
        } else {
          // Default to architect mode for existing projects
          ensureProject(projectId, {
            creationMode: "architect",
            phase: 4,
            unlockedModules: { editor: true, manifest: true, console: true, world_graph: true },
          });
        }

        setActiveProject(projectId);
      } catch (error) {
        console.error("[useProgressiveSync] Failed to load state:", error);
      }
    };

    loadProgressiveState();
  }, [projectId, ensureProject, setActiveProject]);
}
```

#### 2. `apps/mobile/components/progressive/ProgressiveNudge.tsx` (NEW)
**Purpose**: Mobile nudge UI using React Native components

```typescript
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useActiveNudge, useProgressiveStore } from "@mythos/state";
import { Ionicons } from "@expo/vector-icons";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";

export function ProgressiveNudge() {
  const nudge = useActiveNudge();
  const dismissNudge = useProgressiveStore((s) => s.dismissNudge);
  const unlockModule = useProgressiveStore((s) => s.unlockModule);

  if (!nudge) return null;

  const handleDismiss = () => {
    dismissNudge(nudge.id);
  };

  const handleAction = () => {
    if (nudge.type === "entity_discovery") {
      unlockModule(nudge.projectId, "manifest");
    } else if (nudge.type === "feature_unlock") {
      unlockModule(nudge.projectId, nudge.module);
    }
    dismissNudge(nudge.id);
  };

  return (
    <Animated.View
      entering={SlideInDown.springify()}
      exiting={SlideOutDown.springify()}
      style={styles.container}
    >
      <View style={styles.content}>
        <Ionicons
          name={nudge.type === "entity_discovery" ? "people" : "sparkles"}
          size={20}
          color="#00D4FF"
        />
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {nudge.type === "entity_discovery"
              ? "Characters detected"
              : nudge.type === "feature_unlock"
              ? "New feature available"
              : "Inconsistency found"}
          </Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {nudge.type === "entity_discovery"
              ? `${nudge.entities.length} entities found`
              : nudge.type === "feature_unlock"
              ? nudge.message
              : nudge.summary}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={handleAction} style={styles.actionButton}>
          <Text style={styles.actionText}>
            {nudge.type === "entity_discovery" ? "Track" : "Enable"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDismiss} style={styles.dismissButton}>
          <Ionicons name="close" size={20} color="#888" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#333",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  subtitle: {
    color: "#888",
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButton: {
    backgroundColor: "#00D4FF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  actionText: {
    color: "#000",
    fontSize: 13,
    fontWeight: "600",
  },
  dismissButton: {
    padding: 4,
  },
});
```

#### 3. `apps/mobile/app/_layout.tsx`
**Location**: Root layout

**Changes**: Add progressive nudge overlay:
```typescript
import { ProgressiveNudge } from "../components/progressive/ProgressiveNudge";

export default function RootLayout() {
  return (
    <>
      <Stack>
        {/* ... existing screens */}
      </Stack>
      <ProgressiveNudge />
    </>
  );
}
```

### Side Effects
- Requires `@react-native-async-storage/async-storage` for native persistence
- Ensure `@mythos/state` bundle works with Metro bundler
- DB sync introduces potential conflicts; implement last-write-wins or version comparison

---

## Summary: Implementation Priority

| Enhancement | Complexity | Dependencies | Priority |
|-------------|------------|--------------|----------|
| 1. State Persistence | Medium | None | **P1 - Critical** |
| 2. Writing Time Tracking | Low | Enhancement 1 | P2 |
| 3. Linter Integration | High | Linter edge function | **P1 - Critical** |
| 4. Command Palette Gating | Medium | None | P2 |
| 5. Genesis Wizard | High | Edge function infra | P3 |
| 6. Mobile Parity | High | Enhancement 1 + DB sync | P3 |

### Recommended Implementation Order

1. **State Persistence** → Users don't lose progress on refresh
2. **Linter Integration** → Makes Phase 2→3 automatic (core UX)
3. **Command Palette Gating** → Completes progressive disclosure UX
4. **Writing Time Tracking** → Enables usage-based unlock suggestions
5. **Genesis Wizard** → Architect mode polish
6. **Mobile Parity** → Cross-platform consistency

---

## Testing Checklist

### State Persistence
- [ ] Progressive state survives browser refresh
- [ ] Legacy projects default to architect mode
- [ ] Multiple projects maintain separate states
- [ ] State version migration works

### Linter Integration
- [ ] Linter runs after editing in Phase 2
- [ ] Contradictions trigger Phase 2→3 transition
- [ ] Consistency nudge appears with correct issue
- [ ] Resolving issue unlocks console

### Command Palette Gating
- [ ] Locked commands show lock icon
- [ ] Keyboard shortcuts blocked for locked modules
- [ ] Toast shows unlock hint on locked command
- [ ] All commands available in architect mode

### Genesis Wizard
- [ ] Genesis prompt field appears for architect mode
- [ ] Loading state during generation
- [ ] Entities created in database
- [ ] Relationships established
- [ ] Graceful degradation if genesis fails

### Mobile Parity
- [ ] Progressive state syncs from DB
- [ ] Nudges appear on mobile
- [ ] Module unlock works
- [ ] State persists across app restarts
