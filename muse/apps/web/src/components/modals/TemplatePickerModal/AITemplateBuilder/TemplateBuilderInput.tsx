import { useState, useCallback, useRef, type KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button, cn } from "@mythos/ui";

interface TemplateBuilderInputProps {
  onSend: (message: string) => void;
  isStreaming: boolean;
  className?: string;
}

export function TemplateBuilderInput({
  onSend,
  isStreaming,
  className,
}: TemplateBuilderInputProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setInput("");
  }, [input, isStreaming, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className={cn("px-3 py-2 border-t border-mythos-border-default", className)}>
      <div className="relative">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your story idea..."
          disabled={isStreaming}
          rows={2}
          className={cn(
            "w-full resize-none bg-mythos-bg-tertiary rounded-lg px-3 py-2 pr-10",
            "text-sm text-mythos-text-primary placeholder:text-mythos-text-muted",
            "border border-mythos-border-default focus:border-mythos-accent-purple/50",
            "focus:outline-none focus:ring-1 focus:ring-mythos-accent-purple/30",
            "disabled:opacity-50"
          )}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSend}
          disabled={!input.trim() || isStreaming}
          className="absolute right-1 bottom-1 h-7 w-7"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
      <div className="text-[10px] text-mythos-text-muted mt-1.5 text-right">
        Enter to send
      </div>
    </div>
  );
}
