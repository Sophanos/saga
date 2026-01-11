import { useMemo, useState, useEffect } from "react";
import { Button, Card, CardHeader, CardTitle, CardContent, Input, Select } from "@mythos/ui";
import { useAnonymousStore } from "../../stores/anonymous";
import { useMythosStore } from "../../stores";
import { genreSchema } from "@mythos/core";
import type { Genre, StyleMode } from "@mythos/core";
import type { WriterPersonalizationV1 } from "@mythos/core/trial/payload";

type ProjectType = NonNullable<WriterPersonalizationV1["projectType"]>;

const PROJECT_TYPES: ProjectType[] = [
  "novel",
  "series",
  "screenplay",
  "game",
  "world_bible",
  "manga",
];

const ENTITY_TYPE_OPTIONS: Array<NonNullable<WriterPersonalizationV1["trackEntityTypes"]>[number]> = [
  "character",
  "location",
  "item",
  "faction",
  "rule",
  "timeline",
];

const SMART_MODE_OPTIONS: Array<NonNullable<WriterPersonalizationV1["smartMode"]>["level"]> = [
  "off",
  "balanced",
  "adaptive",
];

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

export function TryPersonalizationModal() {
  const personalization = useAnonymousStore((s) => s.personalization);
  const setPersonalization = useAnonymousStore((s) => s.setPersonalization);
  const updateAnonProject = useAnonymousStore((s) => s.updateProject);
  const currentProject = useMythosStore((s) => s.project.currentProject);
  const setCurrentProject = useMythosStore((s) => s.setCurrentProject);

  const isOpen = personalization === null;

  const [genre, setGenre] = useState("");
  const [projectType, setProjectType] = useState<ProjectType>("novel");
  const [styleMode, setStyleMode] = useState<WriterPersonalizationV1["styleMode"]>("prose");
  const [trackEntityTypes, setTrackEntityTypes] = useState<NonNullable<WriterPersonalizationV1["trackEntityTypes"]>>([
    "character",
    "location",
    "item",
  ]);
  const [plotGuardrail, setPlotGuardrail] = useState<NonNullable<WriterPersonalizationV1["guardrails"]>["plot"]>(
    "no_plot_generation"
  );
  const [editGuardrail, setEditGuardrail] = useState<NonNullable<WriterPersonalizationV1["guardrails"]>["edits"]>(
    "proofread_only"
  );
  const [strictness, setStrictness] = useState<NonNullable<WriterPersonalizationV1["guardrails"]>["strictness"]>("medium");
  const [noJudgementMode, setNoJudgementMode] = useState(true);
  const [smartModeLevel, setSmartModeLevel] = useState<NonNullable<WriterPersonalizationV1["smartMode"]>["level"]>(
    "balanced"
  );

  useEffect(() => {
    if (!personalization) return;

    setGenre(personalization.genre ?? "");
    if (personalization.projectType) {
      setProjectType(personalization.projectType);
    } else {
      setProjectType("novel");
    }
    setStyleMode(personalization.styleMode ?? "prose");
    setTrackEntityTypes(personalization.trackEntityTypes ?? ["character", "location", "item"]);
    setPlotGuardrail(personalization.guardrails?.plot ?? "no_plot_generation");
    setEditGuardrail(personalization.guardrails?.edits ?? "proofread_only");
    setStrictness(personalization.guardrails?.strictness ?? "medium");
    setNoJudgementMode(personalization.guardrails?.no_judgement_mode ?? true);
    setSmartModeLevel(personalization.smartMode?.level ?? "balanced");
  }, [personalization]);

  const entityTypeSet = useMemo(() => new Set(trackEntityTypes), [trackEntityTypes]);

  if (!isOpen) return null;

  const handleToggleEntityType = (entityType: typeof ENTITY_TYPE_OPTIONS[number]) => {
    setTrackEntityTypes((prev) => {
      const next = new Set(prev);
      if (next.has(entityType)) {
        next.delete(entityType);
      } else {
        next.add(entityType);
      }
      return Array.from(next);
    });
  };

  const handleSave = () => {
    const next: WriterPersonalizationV1 = {
      genre: genre.trim() || undefined,
      projectType,
      trackEntityTypes,
      styleMode,
      guardrails: {
        plot: plotGuardrail,
        edits: editGuardrail,
        strictness,
        no_judgement_mode: noJudgementMode,
      },
      smartMode: {
        level: smartModeLevel,
      },
    };

    setPersonalization(next);
    updateAnonProject({ genre: next.genre });

    if (currentProject) {
      const nextStyleMode = resolveProjectStyleMode(
        next.styleMode,
        currentProject.config.styleMode ?? "tolkien"
      );
      const nextGenre = resolveProjectGenre(next.genre, currentProject.config.genre);
      const nextGuardrails = next.guardrails
        ? { ...next.guardrails, no_judgement_mode: next.guardrails.no_judgement_mode ?? true }
        : undefined;
      setCurrentProject({
        ...currentProject,
        config: {
          ...currentProject.config,
          genre: nextGenre,
          styleMode: nextStyleMode,
          guardrails: nextGuardrails,
          smartMode: next.smartMode,
        },
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-mythos-bg-primary/80 backdrop-blur-sm"
        aria-hidden="true"
      />
      <Card className="relative z-10 w-full max-w-2xl mx-4 border-mythos-border-default">
        <CardHeader>
          <CardTitle className="text-lg">Personalize your workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-mythos-text-muted">
                Genre
              </label>
              <Input
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="Epic fantasy, thriller, cozy mystery..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-mythos-text-muted">
                Project type
              </label>
              <Select
                value={projectType}
                onChange={(value) => setProjectType(value as ProjectType)}
                options={PROJECT_TYPES.map((type) => ({
                  value: type,
                  label: type.replace(/_/g, " "),
                }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-mythos-text-muted">
              Track these entity types
            </label>
            <div className="flex flex-wrap gap-2">
              {ENTITY_TYPE_OPTIONS.map((entityType) => (
                <button
                  key={entityType}
                  type="button"
                  onClick={() => handleToggleEntityType(entityType)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    entityTypeSet.has(entityType)
                      ? "border-mythos-accent-primary/60 bg-mythos-accent-primary/10 text-mythos-text-primary"
                      : "border-mythos-border-default text-mythos-text-muted hover:text-mythos-text-primary"
                  }`}
                >
                  {entityType.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-mythos-text-muted">
                Plot generation
              </label>
              <Select
                value={plotGuardrail}
                onChange={(value) => setPlotGuardrail(value as NonNullable<WriterPersonalizationV1["guardrails"]>["plot"])}
                options={[
                  { value: "no_plot_generation", label: "Off" },
                  { value: "suggestions_only", label: "Suggestions" },
                  { value: "allow_generation", label: "Allowed" },
                ]}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-mythos-text-muted">
                Edits
              </label>
              <Select
                value={editGuardrail}
                onChange={(value) => setEditGuardrail(value as NonNullable<WriterPersonalizationV1["guardrails"]>["edits"])}
                options={[
                  { value: "proofread_only", label: "Proofread" },
                  { value: "line_edits", label: "Line edits" },
                  { value: "rewrite", label: "Rewrite" },
                ]}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-mythos-text-muted">
                Consistency strictness
              </label>
              <Select
                value={strictness}
                onChange={(value) => setStrictness(value as NonNullable<WriterPersonalizationV1["guardrails"]>["strictness"])}
                options={[
                  { value: "low", label: "Low" },
                  { value: "medium", label: "Medium" },
                  { value: "high", label: "High" },
                ]}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-mythos-text-muted">
              Smart mode
            </label>
            <Select
              value={smartModeLevel}
              onChange={(value) =>
                setSmartModeLevel(value as NonNullable<WriterPersonalizationV1["smartMode"]>["level"])
              }
              options={SMART_MODE_OPTIONS.map((option) => ({
                value: option,
                label: option === "balanced" ? "Balanced" : option === "adaptive" ? "Adaptive" : "Off",
              }))}
            />
            <p className="text-xs text-mythos-text-muted">
              Controls how strongly learned style influences suggestions.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-mythos-text-muted">
              <input
                type="checkbox"
                checked={noJudgementMode}
                onChange={(e) => setNoJudgementMode(e.target.checked)}
                className="accent-mythos-accent-primary"
              />
              No-judgement mode
            </label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-full border border-mythos-border-default bg-mythos-bg-tertiary/40 p-0.5">
                {(["prose", "manga"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setStyleMode(mode)}
                    className={`px-3 py-1 rounded-full text-xs ${
                      styleMode === mode
                        ? "bg-white text-mythos-bg-primary"
                        : "text-mythos-text-muted hover:text-mythos-text-primary"
                    }`}
                  >
                    {mode === "prose" ? "Prose" : "Manga"}
                  </button>
                ))}
              </div>
              <Button onClick={handleSave}>Continue</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
