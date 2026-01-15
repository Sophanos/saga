import { useState, useCallback, useEffect, useRef } from "react";
import { X, ChevronLeft } from "lucide-react";
import { Button, Card, CardHeader, CardTitle, CardContent } from "@mythos/ui";
import type { TemplateDraft, GenesisEntity } from "@mythos/agent-protocol";
import { StartOptions } from "./StartOptions";
import { CreateProjectForm } from "./CreateProjectForm";
import { AITemplateBuilder } from "./AITemplateBuilder";
import type { ProjectType } from "./projectTypes";

type Step = "start" | "ai-builder" | "create";

export interface TemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (projectId: string) => void;
}

const STEP_TITLES: Record<Step, string> = {
  start: "New Project",
  "ai-builder": "Template Builder",
  create: "Create Project",
};

export function TemplatePickerModal({
  isOpen,
  onClose,
  onCreated,
}: TemplatePickerModalProps): JSX.Element | null {
  const [step, setStep] = useState<Step>("start");
  const [projectType, setProjectType] = useState<ProjectType | null>(null);
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft | null>(null);
  const [creationMode, setCreationMode] = useState<"gardener" | "architect">("gardener");
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens and focus the modal
  useEffect(() => {
    if (isOpen) {
      setStep("start");
      setProjectType(null);
      setTemplateDraft(null);
      setCreationMode("gardener");
      // Focus the modal for keyboard handling
      modalRef.current?.focus();
    }
  }, [isOpen]);

  const handleBack = useCallback(() => {
    if (step === "ai-builder") {
      setStep("start");
    } else if (step === "create") {
      if (templateDraft) {
        setStep("ai-builder");
      } else {
        setStep("start");
      }
    }
  }, [step, templateDraft]);

  const handleStartBlank = useCallback(() => {
    if (!projectType) return;
    setTemplateDraft(null);
    setCreationMode("gardener");
    setStep("create");
  }, [projectType]);

  const handleAIBuilder = useCallback(() => {
    if (!projectType) return;
    setStep("ai-builder");
  }, [projectType]);

  const handleUseTemplate = useCallback(
    (draft: TemplateDraft, _entities?: GenesisEntity[]) => {
      setTemplateDraft(draft);
      setCreationMode("architect");
      setStep("create");
    },
    []
  );

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
      <Card className="relative z-10 w-full max-w-5xl mx-4 shadow-xl border-mythos-border-default max-h-[85vh] flex flex-col">
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
              projectType={projectType}
              onSelectProjectType={setProjectType}
              onStartAI={handleAIBuilder}
              onStartBlank={handleStartBlank}
            />
          )}

          {step === "ai-builder" && projectType && (
            <AITemplateBuilder
              projectType={projectType}
              onUseTemplate={handleUseTemplate}
              onCancel={() => setStep("start")}
            />
          )}

          {step === "create" && projectType && (
            <CreateProjectForm
              projectType={projectType}
              templateDraft={templateDraft ?? undefined}
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
