/**
 * useAnonymousProjectLoader
 *
 * Initializes anonymous session and hydrates main stores with anonymous project data.
 * Enables anonymous users to use the real Layout.
 * Creates a "Getting Started" document with onboarding content for new users.
 */

import { useEffect, useState, useRef } from "react";
import { useMythosStore } from "../stores";
import { useAnonymousStore } from "../stores/anonymous";
import { ensureAnonSession } from "../services/anonymousSession";
import { importStory } from "../services/import";
import { genreSchema } from "@mythos/core";
import type { Project, Document, Entity, Relationship, EntityType, Genre, StyleMode } from "@mythos/core";
import type { MythosTrialPayloadV1, WriterPersonalizationV1 } from "@mythos/core/trial/payload";
import { TRIAL_PAYLOAD_KEY, TRIAL_DRAFT_KEY } from "@mythos/core/trial/payload";
import { loadTrialFiles, clearTrialFiles } from "@mythos/storage/trialUploads";

/**
 * Creates the onboarding document content in Tiptap JSON format.
 * Uses only basic nodes that are guaranteed to be supported.
 */
function createOnboardingContent(): unknown {
  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "Welcome to Mythos" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Your story's database. Write below and watch AI extract your characters, locations, and world.",
          },
        ],
      },
      {
        type: "paragraph",
        content: [],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Quick Start" }],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", marks: [{ type: "bold" }], text: "Write or paste your story" },
                  { type: "text", text: " below the line" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", marks: [{ type: "bold" }], text: "AI detects characters" },
                  { type: "text", text: " automatically in the sidebar" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", marks: [{ type: "bold" }], text: "Ask the AI" },
                  { type: "text", text: " using the button in the corner" },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "paragraph",
        content: [],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "---" },
        ],
      },
      {
        type: "paragraph",
        content: [],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            marks: [{ type: "italic" }],
            text: "Your story begins here...",
          },
        ],
      },
      {
        type: "paragraph",
        content: [],
      },
    ],
  };
}

function resolveProjectStyleMode(
  styleMode: WriterPersonalizationV1["styleMode"] | undefined,
  fallback: StyleMode
): StyleMode {
  if (styleMode === "manga") return "manga";
  if (styleMode === "prose") return "tolkien";
  return fallback;
}

function resolveProjectGenre(
  genre: string | undefined,
  fallback: Genre | undefined
): Genre | undefined {
  if (!genre) return fallback;
  const parsed = genreSchema.safeParse(genre.trim());
  return parsed.success ? parsed.data : fallback;
}

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
  const replaceDocuments = useAnonymousStore((s) => s.replaceDocuments);
  const setTryPayload = useAnonymousStore((s) => s.setTryPayload);
  const setPersonalization = useAnonymousStore((s) => s.setPersonalization);
  const markInitialDraftImported = useAnonymousStore((s) => s.markInitialDraftImported);
  const setServerTrialStatus = useAnonymousStore((s) => s.setServerTrialStatus);
  const anonProject = useAnonymousStore((s) => s.project);
  const anonDocuments = useAnonymousStore((s) => s.documents);
  const anonEntities = useAnonymousStore((s) => s.entities);
  const anonRelationships = useAnonymousStore((s) => s.relationships);
  const importedDocumentIds = useAnonymousStore((s) => s.importedDocumentIds);
  const welcomeDocumentId = useAnonymousStore((s) => s.welcomeDocumentId);
  const personalization = useAnonymousStore((s) => s.personalization);

  // Main store actions
  const setCurrentProject = useMythosStore((s) => s.setCurrentProject);
  const setDocuments = useMythosStore((s) => s.setDocuments);
  const setEntities = useMythosStore((s) => s.setEntities);
  const setRelationships = useMythosStore((s) => s.setRelationships);
  const setCurrentDocument = useMythosStore((s) => s.setCurrentDocument);
  const setChatMode = useMythosStore((s) => s.setChatMode);

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

        // Default to floating chat for trial
        setChatMode("floating");

        // Create project if none exists
        let projectId = anonProject?.id;
        const storeState = useAnonymousStore.getState();
        const hasExistingDocuments = storeState.documents.length > 0;
        const alreadyImported = storeState.hasImportedInitialDraft;

        let payload: MythosTrialPayloadV1 | null = null;
        const payloadRaw = sessionStorage.getItem(TRIAL_PAYLOAD_KEY);
        if (payloadRaw) {
          try {
            payload = JSON.parse(payloadRaw) as MythosTrialPayloadV1;
          } catch (parseError) {
            console.warn("[useAnonymousProjectLoader] Failed to parse trial payload:", parseError);
          }
        }

        if (payload) {
          setTryPayload(payload);
          if (payload.personalization) {
            setPersonalization(payload.personalization);
          }
        }

        const legacyDraft = sessionStorage.getItem(TRIAL_DRAFT_KEY);
        const draftText = payload?.text ?? legacyDraft ?? "";

        if (!projectId) {
          projectId = createProject({
            name: draftText ? "Imported Story" : "My Story",
            description: draftText ? "Imported from trial" : undefined,
          });
        }

        const shouldImport = !hasExistingDocuments && !alreadyImported;

        if (projectId && shouldImport) {
          const now = Date.now();
          const welcomeDocId = `temp_doc_${now}_${Math.random().toString(36).slice(2, 9)}`;
          const welcomeDoc = {
            id: welcomeDocId,
            projectId,
            title: "Welcome / Quick Start",
            content: createOnboardingContent(),
            type: "chapter" as const,
            parentId: null,
            orderIndex: 0,
            wordCount: 0,
            createdAt: now,
            updatedAt: now,
          };

          const importedDocs: Document[] = [];
          const importEntityTypes: EntityType[] = [
            "character",
            "location",
            "item",
            "faction",
            "magic_system",
            "concept",
          ];
          const importOptions = {
            format: "auto" as const,
            mode: "append" as const,
            detectEntities: false,
            entityTypes: importEntityTypes,
          };

          if (draftText.trim().length > 0) {
            try {
              const file = new File([draftText], "Imported Draft.txt", { type: "text/plain" });
              const result = await importStory({
                projectId,
                file,
                options: importOptions,
              });
              importedDocs.push(...result.documents);
            } catch (importError) {
              console.warn("[useAnonymousProjectLoader] Failed to import draft text:", importError);
            }
          }

          if (payload?.uploadRefs && payload.uploadRefs.length > 0) {
            try {
              const files = await loadTrialFiles(payload.uploadRefs);
              for (const file of files) {
                try {
                  const result = await importStory({
                    projectId,
                    file,
                    options: importOptions,
                  });
                  importedDocs.push(...result.documents);
                } catch (fileError) {
                  console.warn("[useAnonymousProjectLoader] Failed to import file:", file.name, fileError);
                }
              }
            } catch (loadError) {
              console.warn("[useAnonymousProjectLoader] Failed to load trial uploads:", loadError);
            }
          }

          const importedIds = importedDocs.map((doc) => doc.id);
          const anonymousDocs = [
            welcomeDoc,
            ...importedDocs.map((doc, index) => ({
              id: doc.id,
              projectId: doc.projectId,
              title: doc.title ?? "Untitled",
              content: doc.content,
              type: doc.type,
              parentId: doc.parentId ?? null,
              orderIndex: doc.orderIndex ?? index + 1,
              wordCount: doc.wordCount ?? 0,
              createdAt: doc.createdAt ? new Date(doc.createdAt).getTime() : now,
              updatedAt: doc.updatedAt ? new Date(doc.updatedAt).getTime() : now,
            })),
          ];

          replaceDocuments(anonymousDocs);
          markInitialDraftImported(importedIds, welcomeDocId);

          sessionStorage.removeItem(TRIAL_PAYLOAD_KEY);
          sessionStorage.removeItem(TRIAL_DRAFT_KEY);
          sessionStorage.removeItem("mythos_trial_files");

          if (payload?.uploadRefs && payload.uploadRefs.length > 0) {
            await clearTrialFiles(payload.uploadRefs);
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
  }, [
    startSession,
    createProject,
    replaceDocuments,
    setTryPayload,
    setPersonalization,
    markInitialDraftImported,
    setServerTrialStatus,
    setChatMode,
    anonProject?.id,
  ]);

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
        genre: resolveProjectGenre(personalization?.genre ?? anonProject.genre, undefined),
        styleMode: resolveProjectStyleMode(personalization?.styleMode, "manga"),
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
      parentId: doc.parentId ?? undefined,
      orderIndex: doc.orderIndex ?? 0,
      wordCount: doc.wordCount ?? 0,
      createdAt: new Date(doc.createdAt),
      updatedAt: new Date(doc.updatedAt),
    }));
    setDocuments(documents);

    // Set preferred document (imported > welcome > first)
    if (documents.length > 0) {
      const preferredId = importedDocumentIds[0] ?? welcomeDocumentId ?? null;
      const preferredDoc = preferredId
        ? documents.find((doc) => doc.id === preferredId)
        : documents[0];
      if (preferredDoc) {
        setCurrentDocument(preferredDoc);
      }
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
    importedDocumentIds,
    welcomeDocumentId,
    personalization,
    setCurrentProject,
    setDocuments,
    setEntities,
    setRelationships,
    setCurrentDocument,
  ]);

  return { isLoading, error };
}
