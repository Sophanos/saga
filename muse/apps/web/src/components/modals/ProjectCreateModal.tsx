import { useState, useCallback, useEffect } from "react";
import { X, FolderPlus, Feather, Building2, Sparkles } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  FormField,
  Select,
  TextArea,
} from "@mythos/ui";
import { createProject, createDocument, createEntity, createRelationship } from "@mythos/db";
import { useProgressiveStore } from "@mythos/state";
import { runGenesisViaEdge } from "../../services/ai";
import { createSeedWorldbuildingDoc, embedSeedWorldbuildingDoc, WORLD_SEED_TITLE } from "../../services/projects/seedWorldbuilding";
import { useAuthStore } from "../../stores/auth";

// ============================================================================
// Types
// ============================================================================

type Genre = "fantasy" | "scifi" | "literary" | "mystery" | "romance" | "horror" | "thriller";
type CreationMode = "architect" | "gardener";

interface ProjectFormData {
  name: string;
  description: string;
  genre: Genre | "";
  creationMode: CreationMode;
  genesisPrompt: string;
}

interface ProjectCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (projectId: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const GENRE_OPTIONS: { value: Genre; label: string }[] = [
  { value: "fantasy", label: "Fantasy" },
  { value: "scifi", label: "Science Fiction" },
  { value: "literary", label: "Literary Fiction" },
  { value: "mystery", label: "Mystery" },
  { value: "romance", label: "Romance" },
  { value: "horror", label: "Horror" },
  { value: "thriller", label: "Thriller" },
];

const EMPTY_TIPTAP_DOC = { type: "doc", content: [{ type: "paragraph" }] };

// ============================================================================
// Main Modal Component
// ============================================================================

const initialFormData: ProjectFormData = {
  name: "",
  description: "",
  genre: "",
  creationMode: "gardener",
  genesisPrompt: "",
};

export function ProjectCreateModal({
  isOpen,
  onClose,
  onCreated,
}: ProjectCreateModalProps) {
  const [formData, setFormData] = useState<ProjectFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const userId = useAuthStore((state) => state.user?.id);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(initialFormData);
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const updateFormData = useCallback((updates: Partial<ProjectFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    // Clear errors for updated fields
    const fieldNames = Object.keys(updates);
    setErrors((prev) => {
      const next = { ...prev };
      fieldNames.forEach((f) => delete next[f]);
      return next;
    });
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors["name"] = "Project name is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate() || isSubmitting) return;

      setIsSubmitting(true);

      try {
        if (!userId) {
          throw new Error("Please sign in to create a project.");
        }

        // Create the project
        const project = await createProject({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          genre: formData.genre || null,
          user_id: userId,
        });

        // Create an initial empty document
        await createDocument({
          project_id: project.id,
          type: "chapter",
          title: "Chapter 1",
          content: EMPTY_TIPTAP_DOC,
          content_text: "",
          order_index: 0,
          word_count: 0,
        });

        try {
          const seed = await createSeedWorldbuildingDoc({
            projectId: project.id,
            source: {
              kind: "blank",
              projectName: formData.name.trim(),
              projectDescription: formData.description.trim() || undefined,
              genre: formData.genre || undefined,
              genesisPrompt:
                formData.creationMode === "architect"
                  ? formData.genesisPrompt.trim() || undefined
                  : undefined,
            },
          });

          void embedSeedWorldbuildingDoc({
            projectId: project.id,
            documentId: seed.documentId,
            title: WORLD_SEED_TITLE,
            contentText: seed.contentText,
          });
        } catch (seedError) {
          console.warn("[ProjectCreateModal] Failed to create world seed:", seedError);
        }

        // Initialize progressive state for this project
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
          setGenerationStatus("Generating world...");

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
            setGenerationStatus(`Creating ${genesis.entities.length} entities...`);
            const entityIdMap = new Map<string, string>();

            for (const genEntity of genesis.entities) {
              try {
                const entity = await createEntity({
                  project_id: project.id,
                  name: genEntity.name,
                  type: genEntity.type === "magic_system" ? "item" : genEntity.type,
                  properties: {
                    ...(genEntity.properties || {}),
                    ...(genEntity.description ? { description: genEntity.description } : {}),
                  },
                  aliases: [],
                });
                entityIdMap.set(genEntity.name, entity.id);
              } catch (entityError) {
                console.warn(`Failed to create entity ${genEntity.name}:`, entityError);
              }
            }

            // Create relationships
            setGenerationStatus("Creating relationships...");
            for (const genEntity of genesis.entities) {
              if (!genEntity.relationships) continue;

              const sourceId = entityIdMap.get(genEntity.name);
              if (!sourceId) continue;

              for (const rel of genEntity.relationships) {
                const targetId = entityIdMap.get(rel.targetName);
                if (!targetId) continue;

                try {
                  await createRelationship({
                    project_id: project.id,
                    source_id: sourceId,
                    target_id: targetId,
                    type: rel.type,
                    metadata: rel.description ? { description: rel.description } : {},
                  });
                } catch (relError) {
                  console.warn(`Failed to create relationship:`, relError);
                }
              }
            }

            // Create outline documents if provided
            if (genesis.outline && genesis.outline.length > 0) {
              setGenerationStatus("Creating story outline...");
              for (let i = 0; i < genesis.outline.length; i++) {
                const chapter = genesis.outline[i];
                try {
                  await createDocument({
                    project_id: project.id,
                    type: "chapter",
                    title: chapter.title,
                    content: {
                      type: "doc",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: `// ${chapter.summary}` }],
                        },
                      ],
                    },
                    content_text: `// ${chapter.summary}`,
                    order_index: i + 1,
                    word_count: chapter.summary.split(/\s+/).length,
                  });
                } catch (docError) {
                  console.warn(`Failed to create outline doc:`, docError);
                }
              }
            }

            console.log(
              `[Genesis] Created ${entityIdMap.size} entities from genesis`
            );
          } catch (genesisError) {
            console.error("Genesis failed, continuing with empty project:", genesisError);
            // Don't fail project creation if genesis fails
          } finally {
            setIsGenerating(false);
            setGenerationStatus(null);
          }
        }

        progressive.setActiveProject(project.id);
        onCreated(project.id);
      } catch (error) {
        console.error("Failed to create project:", error);
        setErrors({
          submit: error instanceof Error ? error.message : "Failed to create project",
        });
        setIsSubmitting(false);
      }
    },
    [formData, validate, isSubmitting, onCreated, userId]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    },
    [onClose, isSubmitting]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-create-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-mythos-bg-primary/80 backdrop-blur-sm"
        onClick={isSubmitting ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <Card className="relative z-10 w-full max-w-md mx-4 shadow-xl border-mythos-border-default">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-mythos-accent-primary" />
              <CardTitle id="project-create-title" className="text-lg">
                Create New Project
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-8 w-8 text-mythos-text-muted hover:text-mythos-text-primary"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <CardDescription className="pt-1">
            Start a new writing project. Choose a genre to get tailored suggestions.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pb-4">
            {/* Project Name */}
            <FormField label="Project Name" required error={errors["name"]}>
              <Input
                value={formData.name}
                onChange={(e) => updateFormData({ name: e.target.value })}
                placeholder="Enter project name..."
                autoFocus
                disabled={isSubmitting}
              />
            </FormField>

            {/* Creation Mode Toggle */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-mythos-text-primary">
                How do you want to start?
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => updateFormData({ creationMode: "gardener" })}
                  disabled={isSubmitting}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    formData.creationMode === "gardener"
                      ? "border-mythos-accent-primary bg-mythos-accent-primary/10"
                      : "border-mythos-border-default hover:border-mythos-text-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Feather className={`w-4 h-4 ${
                      formData.creationMode === "gardener"
                        ? "text-mythos-accent-primary"
                        : "text-mythos-text-muted"
                    }`} />
                    <span className={`font-medium text-sm ${
                      formData.creationMode === "gardener"
                        ? "text-mythos-text-primary"
                        : "text-mythos-text-secondary"
                    }`}>
                      Start Writing
                    </span>
                  </div>
                  <p className="text-xs text-mythos-text-muted">
                    Dive in and discover your world as you write
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => updateFormData({ creationMode: "architect" })}
                  disabled={isSubmitting}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    formData.creationMode === "architect"
                      ? "border-mythos-accent-purple bg-mythos-accent-purple/10"
                      : "border-mythos-border-default hover:border-mythos-text-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className={`w-4 h-4 ${
                      formData.creationMode === "architect"
                        ? "text-mythos-accent-purple"
                        : "text-mythos-text-muted"
                    }`} />
                    <span className={`font-medium text-sm ${
                      formData.creationMode === "architect"
                        ? "text-mythos-text-primary"
                        : "text-mythos-text-secondary"
                    }`}>
                      Build Your World
                    </span>
                  </div>
                  <p className="text-xs text-mythos-text-muted">
                    Plan your world structure before writing
                  </p>
                </button>
              </div>
            </div>

            {/* Genre */}
            <FormField label="Genre">
              <Select
                value={formData.genre}
                onChange={(v) => updateFormData({ genre: v as Genre | "" })}
                options={GENRE_OPTIONS}
                placeholder="Select a genre..."
                disabled={isSubmitting}
              />
            </FormField>

            {/* Genesis Prompt (Architect mode only) */}
            {formData.creationMode === "architect" && (
              <FormField label="World Concept">
                <TextArea
                  value={formData.genesisPrompt}
                  onChange={(v) => updateFormData({ genesisPrompt: v })}
                  placeholder="A dystopian city where emotions are illegal and the protagonist discovers they can feel..."
                  rows={4}
                  disabled={isSubmitting || isGenerating}
                />
              </FormField>
            )}

            {/* Description */}
            <FormField label="Description">
              <TextArea
                value={formData.description}
                onChange={(v) => updateFormData({ description: v })}
                placeholder="A brief description of your project..."
                rows={3}
                disabled={isSubmitting || isGenerating}
              />
            </FormField>

            {/* Submit Error */}
            {errors["submit"] && (
              <div className="p-3 rounded-md bg-mythos-accent-red/10 border border-mythos-accent-red/30">
                <p className="text-sm text-mythos-accent-red">{errors["submit"]}</p>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-between gap-2 pt-4 border-t border-mythos-border-default">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting || isGenerating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isGenerating}
              className="gap-1.5 min-w-[140px]"
            >
              {isGenerating ? (
                <>
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  {generationStatus || "Generating..."}
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
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export type { ProjectCreateModalProps };
