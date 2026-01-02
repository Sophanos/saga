import { useCallback } from "react";
import { Loader2, Wand2, X } from "lucide-react";
import { Button, ScrollArea, cn } from "@mythos/ui";
import type { TemplateDraft, GenesisEntity } from "@mythos/agent-protocol";
import { useTemplateBuilderAgent, type BuilderMessage } from "./useTemplateBuilderAgent";
import { PromptSuggestions } from "./PromptSuggestions";
import { TemplateBuilderInput } from "./TemplateBuilderInput";

interface AITemplateBuilderProps {
  onTemplateGenerated: (draft: TemplateDraft, starterEntities?: GenesisEntity[]) => void;
  onCancel?: () => void;
}

function MessageBubble({ message }: { message: BuilderMessage }) {
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

export function AITemplateBuilder({ onTemplateGenerated }: AITemplateBuilderProps) {
  const {
    messages,
    isStreaming,
    error,
    sendMessage,
    pendingTool,
    executeTool,
    rejectTool,
  } = useTemplateBuilderAgent();

  const handleSuggestionSelect = useCallback(
    (prompt: string) => {
      sendMessage(prompt);
    },
    [sendMessage]
  );

  const handleGenerate = useCallback(async () => {
    const result = await executeTool();
    if (result) {
      onTemplateGenerated(result.template, result.suggestedStarterEntities);
    }
  }, [executeTool, onTemplateGenerated]);

  const showEmptyState = messages.length === 0;
  const showGenerateButton = pendingTool?.status === "proposed";
  const isExecuting = pendingTool?.status === "executing";

  return (
    <div className="flex flex-col h-[60vh]">
      {/* Messages area */}
      <div className="flex-1 min-h-0">
        {showEmptyState ? (
          <PromptSuggestions onSelect={handleSuggestionSelect} disabled={isStreaming} />
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

      {/* Error display */}
      {error && (
        <div className="mx-3 mb-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Generate button when tool is proposed */}
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

      {/* Executing state */}
      {isExecuting && (
        <div className="mx-3 mb-2 p-3 rounded-lg bg-mythos-accent-purple/10 border border-mythos-accent-purple/30">
          <div className="flex items-center gap-2 text-sm text-mythos-text-primary">
            <Loader2 className="w-4 h-4 text-mythos-accent-purple animate-spin" />
            Generating your template...
          </div>
        </div>
      )}

      {/* Input */}
      <TemplateBuilderInput onSend={sendMessage} isStreaming={isStreaming || isExecuting} />
    </div>
  );
}
