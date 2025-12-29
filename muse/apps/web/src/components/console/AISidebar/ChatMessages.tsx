import { useRef, useEffect } from "react";
import { User, Bot, Loader2 } from "lucide-react";
import { ScrollArea, cn } from "@mythos/ui";
import { formatTime24 } from "@mythos/core";
import type { ChatMessage } from "../../../stores";
import { ToolResultCard } from "./ToolResultCard";

interface ChatMessagesProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  className?: string;
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isTool = message.kind === "tool" && message.tool;

  return (
    <div
      className={cn(
        "flex gap-2.5 px-3 py-2",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
          isUser
            ? "bg-mythos-accent-cyan/20"
            : "bg-mythos-accent-purple/20"
        )}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5 text-mythos-accent-cyan" />
        ) : (
          <Bot className="w-3.5 h-3.5 text-mythos-accent-purple" />
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          "flex-1 min-w-0 max-w-[85%]",
          isUser ? "text-right" : "text-left"
        )}
      >
        <div
          className={cn(
            "inline-block rounded-lg px-3 py-2 text-sm",
            isUser
              ? "bg-mythos-accent-cyan/10 text-mythos-text-primary"
              : "bg-mythos-bg-tertiary text-mythos-text-primary"
          )}
        >
          {/* Render content or tool result */}
          {isTool ? (
            <ToolResultCard messageId={message.id} tool={message.tool!} />
          ) : (
            <div className="whitespace-pre-wrap break-words prose prose-invert prose-sm max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0">
              {message.content}
              {message.isStreaming && (
                <span className="inline-block w-1.5 h-4 bg-mythos-accent-purple animate-pulse ml-0.5" />
              )}
            </div>
          )}
        </div>

        {/* Mentions */}
        {message.mentions && message.mentions.length > 0 && (
          <div className={cn(
            "flex flex-wrap gap-1 mt-1",
            isUser ? "justify-end" : "justify-start"
          )}>
            {message.mentions.map((m) => (
              <span
                key={m.id}
                className="text-[10px] px-1.5 py-0.5 rounded bg-mythos-bg-tertiary text-mythos-text-muted"
              >
                @{m.name}
              </span>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div className="text-[10px] text-mythos-text-muted mt-1">
          {formatTime24(message.timestamp)}
        </div>
      </div>
    </div>
  );
}

export function ChatMessages({
  messages,
  isStreaming,
  className,
}: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return (
      <div className={cn("flex-1 flex items-center justify-center p-4", className)}>
        <div className="text-center">
          <Bot className="w-10 h-10 text-mythos-accent-purple/30 mx-auto mb-3" />
          <h4 className="text-sm font-medium text-mythos-text-secondary mb-1">
            Story Assistant
          </h4>
          <p className="text-xs text-mythos-text-muted max-w-[200px]">
            Ask questions about your story, brainstorm ideas, or get help with your writing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className={cn("flex-1", className)} ref={scrollRef}>
      <div className="py-2">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {/* Loading indicator */}
        {isStreaming && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-2.5 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-mythos-accent-purple/20 flex items-center justify-center">
              <Loader2 className="w-3.5 h-3.5 text-mythos-accent-purple animate-spin" />
            </div>
            <div className="flex items-center">
              <span className="text-sm text-mythos-text-muted">Thinking...</span>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
