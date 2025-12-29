import { useState, useCallback, useEffect, useRef } from "react";
import { X, ChevronLeft } from "lucide-react";
import { Button, Card, CardHeader, CardTitle, CardContent } from "@mythos/ui";
import type { ProjectTemplate } from "@mythos/core";
import { BLANK_TEMPLATE } from "@mythos/core";
import type { TemplateDraft, GenesisEntity } from "@mythos/agent-protocol";
import { StartOptions } from "./StartOptions";
import { TemplateGrid } from "./TemplateGrid";
import { CreateProjectForm } from "./CreateProjectForm";
import { AITemplateBuilder } from "./AITemplateBuilder";
import { TemplateDraftPreview } from "./TemplateDraftPreview";
import { convertDraftToTemplate } from "./utils/convertDraftToTemplate";

type Step = "start" | "browse" | "ai-builder" | "preview" | "create";

export interface TemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (projectId: string) => void;
}

const STEP_TITLES: Record<Step, string> = {
  start: "New Project",
  browse: "Choose a Template",
  "ai-builder": "Create with AI",
  preview: "Review Template",
  create: "Create Project",
};

export function TemplatePickerModal({
  isOpen,
  onClose,
  onCreated,
}: TemplatePickerModalProps) {
  const [step, setStep] = useState<Step>("start");
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [creationMode, setCreationMode] = useState<"gardener" | "architect">("gardener");
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft | null>(null);
  const [starterEntities, setStarterEntities] = useState<GenesisEntity[]>([]);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens and focus the modal
  useEffect(() => {
    if (isOpen) {
      setStep("start");
      setSelectedTemplate(null);
      setCreationMode("gardener");
      setTemplateDraft(null);
      setStarterEntities([]);
      // Focus the modal for keyboard handling
      modalRef.current?.focus();
    }
  }, [isOpen]);

  const handleBack = useCallback(() => {
    if (step === "browse" || step === "ai-builder") {
      setStep("start");
    } else if (step === "preview") {
      setStep("ai-builder");
    } else if (step === "create") {
      if (selectedTemplate?.id?.startsWith("ai-")) {
        setStep("preview");
      } else if (selectedTemplate?.id === "blank") {
        setStep("start");
      } else {
        setStep("browse");
      }
    }
  }, [step, selectedTemplate]);

  const handleStartBlank = useCallback(() => {
    setSelectedTemplate(BLANK_TEMPLATE);
    setCreationMode("gardener");
    setStep("create");
  }, []);

  const handleBrowseTemplates = useCallback(() => {
    setStep("browse");
  }, []);

  const handleAIBuilder = useCallback(() => {
    setStep("ai-builder");
  }, []);

  const handleSelectTemplate = useCallback((template: ProjectTemplate) => {
    setSelectedTemplate(template);
    setCreationMode("architect");
    setStep("create");
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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  const showBackButton = step !== "start";

  return (
    <div
      ref={modalRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-picker-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-mythos-bg-primary/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <Card className="relative z-10 w-full max-w-2xl mx-4 shadow-xl border-mythos-text-muted/30 max-h-[85vh] flex flex-col">
        <CardHeader className="pb-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {showBackButton && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBack}
                  className="h-8 w-8 text-mythos-text-muted hover:text-mythos-text-primary -ml-2"
                  aria-label="Go back"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              )}
              <CardTitle id="template-picker-title" className="text-lg">
                {STEP_TITLES[step]}
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-mythos-text-muted hover:text-mythos-text-primary"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pb-6 overflow-y-auto flex-1">
          {step === "start" && (
            <StartOptions
              onStartBlank={handleStartBlank}
              onBrowseTemplates={handleBrowseTemplates}
              onAIBuilder={handleAIBuilder}
            />
          )}

          {step === "browse" && (
            <TemplateGrid onSelectTemplate={handleSelectTemplate} />
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
              onCreated={onCreated}
              onClose={onClose}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
