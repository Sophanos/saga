import { useCallback, useRef } from "react";
import { Loader2, Wand2, X } from "lucide-react";
import { Button, ScrollArea, cn } from "@mythos/ui";
import type { GenesisEntity, TemplateDraft } from "@mythos/agent-protocol";
import { useTemplateBuilderAgent, type BuilderMessage } from "./useTemplateBuilderAgent";
import { PromptSuggestions } from "./PromptSuggestions";
import { TemplateBuilderInput } from "./TemplateBuilderInput";
import { PhaseIndicator } from "./PhaseIndicator";
import { ProgressiveTemplatePreview } from "./ProgressiveTemplatePreview";
import { PROJECT_TYPE_DEFS, type ProjectType } from "../projectTypes";

interface AITemplateBuilderProps {
  projectType: ProjectType;
  onUseTemplate: (draft: TemplateDraft, starterEntities?: GenesisEntity[]) => void;
  onCancel?: () => void;
}

function MessageBubble({ message }: { message: BuilderMessage }): JSX.Element {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-2 px-3 py-1.5", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "inline-block rounded-lg px-3 py-2 text-sm max-w-[85%]",
          isUser
            ? "bg-mythos-accent-primary/10 text-mythos-text-primary"
            : "bg-mythos-bg-tertiary text-mythos-text-primary"
        )}
      >
        <div className="whitespace-pre-wrap break-words">
          {message.content}
          {message.isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-mythos-accent-purple animate-pulse ml-0.5" />
          )}
        </div>
      </div>
    </div>
  );
}

export function AITemplateBuilder({
  projectType,
  onUseTemplate,
  onCancel,
}: AITemplateBuilderProps): JSX.Element {
  const {
    messages,
    isStreaming,
    error,
    sendMessage,
    pendingTool,
    executeTool,
    rejectTool,
    draft,
    starterEntities,
    phase,
    markAccepted,
  } = useTemplateBuilderAgent({ projectType });

  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSuggestionSelect = useCallback(
    (prompt: string) => {
      sendMessage(prompt);
    },
    [sendMessage]
  );

  const handleGenerate = useCallback(async () => {
    await executeTool();
  }, [executeTool]);

  const handleUseTemplate = useCallback(() => {
    if (!draft) return;
    markAccepted();
    onUseTemplate(draft, starterEntities);
  }, [draft, markAccepted, onUseTemplate, starterEntities]);

  const handleRefine = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const showEmptyState = messages.length === 0;
  const showGenerateButton = pendingTool?.status === "proposed";
  const isExecuting = pendingTool?.status === "executing";
  const placeholder = `Describe your ${PROJECT_TYPE_DEFS[projectType].label.toLowerCase()} idea...`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-4 h-[65vh]">
      <div className="flex flex-col min-h-0 rounded-lg border border-mythos-border-default bg-mythos-bg-secondary/40">
        <div className="flex-1 min-h-0">
          {showEmptyState ? (
            <PromptSuggestions
              projectType={projectType}
              onSelect={handleSuggestionSelect}
              disabled={isStreaming}
            />
          ) : (
            <ScrollArea className="h-full">
              <div className="py-2">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                {isStreaming && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex gap-2 px-3 py-1.5">
                    <div className="flex items-center gap-2 text-sm text-mythos-text-muted">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Thinking...
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        {error && (
          <div className="mx-3 mb-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs">
            {error}
          </div>
        )}

        {showGenerateButton && (
          <div className="mx-3 mb-2 p-3 rounded-lg bg-mythos-accent-purple/10 border border-mythos-accent-purple/30">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-mythos-text-primary">
                <Wand2 className="w-4 h-4 text-mythos-accent-purple" />
                Ready to generate your template
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={rejectTool}>
                  <X className="w-3.5 h-3.5 mr-1" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleGenerate}>
                  Generate
                </Button>
              </div>
            </div>
          </div>
        )}

        {isExecuting && (
          <div className="mx-3 mb-2 p-3 rounded-lg bg-mythos-accent-purple/10 border border-mythos-accent-purple/30">
            <div className="flex items-center gap-2 text-sm text-mythos-text-primary">
              <Loader2 className="w-4 h-4 text-mythos-accent-purple animate-spin" />
              Generating your template...
            </div>
          </div>
        )}

        <TemplateBuilderInput
          onSend={sendMessage}
          isStreaming={isStreaming || isExecuting}
          placeholder={placeholder}
          inputRef={inputRef}
        />
      </div>

      <div className="flex flex-col min-h-0 rounded-lg border border-mythos-border-default bg-mythos-bg-secondary/40">
        <div className="px-4 py-3 border-b border-mythos-border-default">
          <PhaseIndicator phase={phase} projectType={projectType} />
        </div>
        <div className="flex-1 min-h-0 p-4">
          <ProgressiveTemplatePreview
            projectType={projectType}
            phase={phase}
            draft={draft}
            starterEntities={starterEntities}
            isGenerating={isExecuting}
            isReadyToGenerate={showGenerateButton}
            onUseTemplate={handleUseTemplate}
            onCancel={onCancel}
            onRefine={handleRefine}
          />
        </div>
      </div>
    </div>
  );
}
