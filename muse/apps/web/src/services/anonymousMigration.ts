/**
 * Anonymous Data Migration Service
 *
 * Migrates localStorage data to Supabase after user authenticates.
 * Called once after successful auth if anonymous data exists.
 */

import { getSupabaseClient } from "@mythos/db";
import { useAnonymousStore } from "../stores/anonymous";

interface MigrationResult {
  success: boolean;
  projectId?: string;
  error?: string;
  migrated: {
    project: boolean;
    documents: number;
    entities: number;
    relationships: number;
  };
}

/**
 * Migrate anonymous session data to authenticated user's account.
 *
 * @param userId - The authenticated user's ID
 * @returns Migration result with new project ID
 */
export async function migrateAnonymousData(userId: string): Promise<MigrationResult> {
  const data = useAnonymousStore.getState().getDataForMigration();

  if (!data.project) {
    return {
      success: true,
      migrated: { project: false, documents: 0, entities: 0, relationships: 0 },
    };
  }

  const supabase = getSupabaseClient();
  const idMap = new Map<string, string>(); // temp_id -> real_id

  try {
    // 1. Create the project
    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .insert({
        name: data.project.name,
        description: data.project.description ?? null,
        genre: data.project.genre ?? null,
        user_id: userId,
        template_id: data.project.templateId ?? null,
      } as never)
      .select("id")
      .single();

    if (projectError || !projectData) {
      throw new Error(projectError?.message ?? "Failed to create project");
    }

    const projectId = (projectData as { id: string }).id;
    idMap.set(data.project.id, projectId);

    // 2. Migrate documents
    let documentsCreated = 0;
    for (const doc of data.documents) {
      const { data: docData, error: docError } = await supabase
        .from("documents")
        .insert({
          project_id: projectId,
          title: doc.title,
          content: doc.content,
          type: doc.type,
          user_id: userId,
        } as never)
        .select("id")
        .single();

      if (!docError && docData) {
        idMap.set(doc.id, (docData as { id: string }).id);
        documentsCreated++;
      }
    }

    // 3. Migrate entities
    let entitiesCreated = 0;
    for (const entity of data.entities) {
      const { data: entityData, error: entityError } = await supabase
        .from("entities")
        .insert({
          project_id: projectId,
          name: entity.name,
          type: entity.type,
          properties: entity.properties,
        } as never)
        .select("id")
        .single();

      if (!entityError && entityData) {
        idMap.set(entity.id, (entityData as { id: string }).id);
        entitiesCreated++;
      }
    }

    // 4. Migrate relationships (with ID remapping)
    let relationshipsCreated = 0;
    for (const rel of data.relationships) {
      const sourceId = idMap.get(rel.sourceId);
      const targetId = idMap.get(rel.targetId);

      if (sourceId && targetId) {
        const { error: relError } = await supabase.from("relationships").insert({
          project_id: projectId,
          source_id: sourceId,
          target_id: targetId,
          type: rel.type,
        } as never);

        if (!relError) {
          relationshipsCreated++;
        }
      }
    }

    // 5. Clear anonymous data after successful migration
    useAnonymousStore.getState().clearAllData();

    return {
      success: true,
      projectId,
      migrated: {
        project: true,
        documents: documentsCreated,
        entities: entitiesCreated,
        relationships: relationshipsCreated,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Migration failed",
      migrated: { project: false, documents: 0, entities: 0, relationships: 0 },
    };
  }
}

/**
 * Check if there's anonymous data to migrate.
 */
export function hasAnonymousDataToMigrate(): boolean {
  const state = useAnonymousStore.getState();
  return (
    state.project !== null ||
    state.documents.length > 0 ||
    state.entities.length > 0 ||
    state.chatMessages.length > 0
  );
}

/**
 * Get a summary of what will be migrated.
 */
export function getAnonymousMigrationSummary(): {
  hasData: boolean;
  project: string | null;
  documentCount: number;
  entityCount: number;
  chatMessageCount: number;
  actions: string[];
} {
  const state = useAnonymousStore.getState();
  return {
    hasData: hasAnonymousDataToMigrate(),
    project: state.project?.name ?? null,
    documentCount: state.documents.length,
    entityCount: state.entities.length,
    chatMessageCount: state.chatMessages.length,
    actions: state.actions,
  };
}
