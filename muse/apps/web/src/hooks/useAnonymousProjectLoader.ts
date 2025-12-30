/**
 * useAnonymousProjectLoader
 *
 * Initializes anonymous session and hydrates main stores with anonymous project data.
 * Enables anonymous users to use the real Layout.
 */

import { useEffect, useState, useRef } from "react";
import { useMythosStore } from "../stores";
import { useAnonymousStore } from "../stores/anonymous";
import { ensureAnonSession } from "../services/anonymousSession";
import type { Project, Document, Entity, Relationship } from "@mythos/core";

interface UseAnonymousProjectLoaderResult {
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook that initializes anonymous session and loads anonymous project data
 * into the main application stores.
 */
export function useAnonymousProjectLoader(): UseAnonymousProjectLoaderResult {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  // Anonymous store actions
  const startSession = useAnonymousStore((s) => s.startSession);
  const createProject = useAnonymousStore((s) => s.createProject);
  const setServerTrialStatus = useAnonymousStore((s) => s.setServerTrialStatus);
  const anonProject = useAnonymousStore((s) => s.project);
  const anonDocuments = useAnonymousStore((s) => s.documents);
  const anonEntities = useAnonymousStore((s) => s.entities);
  const anonRelationships = useAnonymousStore((s) => s.relationships);

  // Main store actions
  const setCurrentProject = useMythosStore((s) => s.setCurrentProject);
  const setDocuments = useMythosStore((s) => s.setDocuments);
  const setEntities = useMythosStore((s) => s.setEntities);
  const setRelationships = useMythosStore((s) => s.setRelationships);
  const setCurrentDocument = useMythosStore((s) => s.setCurrentDocument);

  useEffect(() => {
    // Prevent double initialization in React strict mode
    if (initializedRef.current) return;
    initializedRef.current = true;

    async function init() {
      try {
        setIsLoading(true);
        setError(null);

        // Start local anonymous session
        startSession();

        // Get/create server session for trial limits
        const session = await ensureAnonSession();
        setServerTrialStatus(session.trial);

        // Create project if none exists
        let projectId = anonProject?.id;
        if (!projectId) {
          // Check if user came from landing page with draft content
          const draftContent = sessionStorage.getItem("mythos_trial_draft");

          projectId = createProject({
            name: draftContent ? "Imported Story" : "Untitled Project",
            description: draftContent ? "Imported from trial" : undefined,
          });

          // Clear the draft from session storage
          if (draftContent) {
            sessionStorage.removeItem("mythos_trial_draft");
            sessionStorage.removeItem("mythos_trial_files");
          }
        }
      } catch (err) {
        console.error("[useAnonymousProjectLoader] Failed to initialize:", err);
        setError("Failed to start trial. Please refresh and try again.");
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, [startSession, createProject, setServerTrialStatus, anonProject?.id]);

  // Hydrate main stores when anonymous data changes
  useEffect(() => {
    if (!anonProject) return;

    // Convert anonymous project to main Project type
    // Cast to Project since anonymous data has compatible structure
    const project = {
      id: anonProject.id,
      name: anonProject.name,
      description: anonProject.description,
      config: {
        styleMode: "manga",
        arcTemplate: "three_act",
        linterConfig: {
          nameConsistency: "error",
          visualConsistency: "warning",
          locationConsistency: "warning",
          timelineConsistency: "info",
          archetypeDeviation: "warning",
          powerScaling: "info",
          pacingFlat: "info",
          dialogueLength: "off",
          adverbUsage: "off",
          passiveVoice: "off",
          showDontTell: "off",
          symbolismConsistency: "off",
        },
      },
      createdAt: new Date(anonProject.createdAt),
      updatedAt: new Date(anonProject.createdAt),
    } as Project;

    setCurrentProject(project);

    // Convert and set documents
    const documents: Document[] = anonDocuments.map((doc) => ({
      id: doc.id,
      projectId: doc.projectId,
      type: doc.type,
      title: doc.title,
      content: doc.content,
      orderIndex: 0,
      wordCount: 0,
      createdAt: new Date(doc.createdAt),
      updatedAt: new Date(doc.updatedAt),
    }));
    setDocuments(documents);

    // Set first document as current if exists
    if (documents.length > 0) {
      setCurrentDocument(documents[0]);
    }

    // Convert and set entities (add required fields)
    const entities: Entity[] = anonEntities.map((e) => ({
      id: e.id,
      projectId: e.projectId,
      name: e.name,
      type: e.type,
      properties: e.properties as Entity["properties"],
      aliases: [],
      mentions: [],
      createdAt: new Date(e.createdAt),
      updatedAt: new Date(e.createdAt),
    }));
    setEntities(entities);

    // Convert and set relationships
    const relationships: Relationship[] = anonRelationships.map((r) => ({
      id: r.id,
      sourceId: r.sourceId,
      targetId: r.targetId,
      type: r.type as Relationship["type"],
      bidirectional: false,
      createdAt: new Date(r.createdAt),
    }));
    setRelationships(relationships);
  }, [
    anonProject,
    anonDocuments,
    anonEntities,
    anonRelationships,
    setCurrentProject,
    setDocuments,
    setEntities,
    setRelationships,
    setCurrentDocument,
  ]);

  return { isLoading, error };
}
