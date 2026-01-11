import { useState, useCallback, useEffect, useRef } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@mythos/ui";
import type { ProjectTemplate } from "@mythos/core";
import { BLANK_TEMPLATE } from "@mythos/core";
import type { TemplateDraft, GenesisEntity } from "@mythos/agent-protocol";
import { StartOptions } from "../modals/TemplatePickerModal/StartOptions";
import { CreateProjectForm } from "../modals/TemplatePickerModal/CreateProjectForm";
import { AITemplateBuilder } from "../modals/TemplatePickerModal/AITemplateBuilder";
import { TemplateDraftPreview } from "../modals/TemplatePickerModal/TemplateDraftPreview";
import { convertDraftToTemplate } from "../modals/TemplatePickerModal/utils/convertDraftToTemplate";
import {
  useRequestedProjectStartAction,
  useClearProjectStartAction,
} from "../../stores/projectStart";
import { useMythosStore } from "../../stores";

type Step = "start" | "ai-builder" | "preview" | "create";

interface ProjectStartCanvasProps {
  onProjectCreated: (projectId: string) => void;
}

const STEP_TITLES: Record<Step, string> = {
  start: "Start a project",
  "ai-builder": "Create with AI",
  preview: "Review template",
  create: "Create project",
};

export function ProjectStartCanvas({ onProjectCreated }: ProjectStartCanvasProps) {
  const [step, setStep] = useState<Step>("start");
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [creationMode, setCreationMode] = useState<"gardener" | "architect">("gardener");
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft | null>(null);
  const [starterEntities, setStarterEntities] = useState<GenesisEntity[]>([]);

  const requestedAction = useRequestedProjectStartAction();
  const clearRequestedAction = useClearProjectStartAction();
  const setActiveTab = useMythosStore((s) => s.setActiveTab);
  const initializedRef = useRef(false);

  const handleBack = useCallback(() => {
    if (step === "ai-builder") {
      setStep("start");
    } else if (step === "preview") {
      setStep("ai-builder");
    } else if (step === "create") {
      if (selectedTemplate?.id?.startsWith("ai-")) {
        setStep("preview");
      } else {
        setStep("start");
      }
    }
  }, [step, selectedTemplate]);

  const handleStartBlank = useCallback(() => {
    setSelectedTemplate(BLANK_TEMPLATE);
    setCreationMode("gardener");
    setStep("create");
  }, []);

  const handleAIBuilder = useCallback(() => {
    setStep("ai-builder");
  }, []);

  const handleTemplateGenerated = useCallback(
    (draft: TemplateDraft, entities?: GenesisEntity[]) => {
      setTemplateDraft(draft);
      setStarterEntities(entities ?? []);
      setStep("preview");
    },
    []
  );

  const handleAcceptTemplate = useCallback(() => {
    if (!templateDraft) return;
    const generated = convertDraftToTemplate(templateDraft);
    setSelectedTemplate(generated);
    setCreationMode("architect");
    setStep("create");
  }, [templateDraft]);

  useEffect(() => {
    if (!requestedAction) return;

    if (requestedAction === "start-blank") {
      handleStartBlank();
    } else if (requestedAction === "ai-builder") {
      handleAIBuilder();
    }

    clearRequestedAction();
  }, [
    requestedAction,
    handleStartBlank,
    handleAIBuilder,
    clearRequestedAction,
  ]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    setActiveTab("chat");
  }, [setActiveTab]);

  const showBackButton = step !== "start";

  return (
    <div className="h-full w-full flex items-start justify-center px-6 py-10">
      <div className="w-full max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-serif font-bold text-mythos-text-primary">
            Create your first project
          </h1>
          <p className="text-sm text-mythos-text-muted mt-2">
            Choose a template, start blank, or let AI build your world structure.
          </p>
        </div>

        <div className="rounded-xl border border-mythos-border-default bg-mythos-bg-secondary/40 shadow-lg">
          <div className="flex items-center justify-between px-4 py-3 border-b border-mythos-border-default">
            <div className="flex items-center gap-2">
              {showBackButton ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBack}
                  className="h-8 w-8 text-mythos-text-muted hover:text-mythos-text-primary -ml-2"
                  aria-label="Go back"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              ) : (
                <div className="w-8" />
              )}
              <h2 className="text-sm font-medium text-mythos-text-primary">
                {STEP_TITLES[step]}
              </h2>
            </div>
            <span className="text-[11px] uppercase tracking-wide text-mythos-text-muted">
              Templates
            </span>
          </div>

          <div className="p-4">
            {step === "start" && (
              <StartOptions
                onStartBlank={handleStartBlank}
                onAIBuilder={handleAIBuilder}
              />
            )}

            {step === "ai-builder" && (
              <AITemplateBuilder
                onTemplateGenerated={handleTemplateGenerated}
                onCancel={() => setStep("start")}
              />
            )}

            {step === "preview" && templateDraft && (
              <TemplateDraftPreview
                draft={templateDraft}
                starterEntities={starterEntities}
                onAccept={handleAcceptTemplate}
                onRefine={() => setStep("ai-builder")}
                onCancel={() => setStep("start")}
              />
            )}

            {step === "create" && selectedTemplate && (
              <CreateProjectForm
                template={selectedTemplate}
                creationMode={creationMode}
                onCreated={onProjectCreated}
                onClose={handleBack}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
