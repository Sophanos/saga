import { useCallback } from "react";
import { Trash2 } from "lucide-react";
import { Button, cn } from "@mythos/ui";
import {
  useMythosStore,
  useChatMessages,
  useIsChatStreaming,
  useChatError,
  type ChatMention,
} from "../../../stores";
import { useChatAgent } from "../../../hooks/useChatAgent";
import { useEditorSelection } from "../../../hooks/useEditorSelection";
import { ContextBar } from "./ContextBar";
import { QuickActions } from "./QuickActions";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import type { Editor } from "@mythos/editor";

interface AISidebarProps {
  className?: string;
}

/**
 * Enhanced AI chat sidebar with context awareness, quick actions, and mentions
 */
export function AISidebar({ className }: AISidebarProps) {
  const messages = useChatMessages();
  const isStreaming = useIsChatStreaming();
  const error = useChatError();

  const { sendMessage, stopStreaming, clearChat } = useChatAgent();

  // Get current document and editor for context
  const currentDocument = useMythosStore((s) => s.document.currentDocument);
  const editorInstance = useMythosStore((s) => s.editor.editorInstance) as Editor | null;

  // Get selection text from editor (properly reactive via selectionUpdate events)
  const selectionText = useEditorSelection(editorInstance);

  // Handle message send
  const handleSend = useCallback(
    (content: string, mentions: ChatMention[]) => {
      sendMessage(content, mentions);
    },
    [sendMessage]
  );

  // Handle quick action
  const handleQuickAction = useCallback(
    (prompt: string) => {
      sendMessage(prompt, []);
    },
    [sendMessage]
  );

  // Handle clear selection (for context bar)
  const handleClearSelection = useCallback(() => {
    if (editorInstance) {
      const pos = editorInstance.state.selection.from;
      editorInstance.commands.setTextSelection(pos);
    }
  }, [editorInstance]);

  return (
    <div className={cn("h-full flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-mythos-text-muted/20">
        <span className="text-sm font-medium text-mythos-text-primary">
          AI Assistant
        </span>
        <div className="flex items-center gap-1">
          {isStreaming && (
            <Button
              variant="ghost"
              size="sm"
              onClick={stopStreaming}
              className="text-xs h-6 px-2 text-mythos-accent-red"
            >
              Stop
            </Button>
          )}
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={clearChat}
              className="h-6 w-6"
              title="Clear chat"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Context bar - shows current doc/selection */}
      <ContextBar
        documentTitle={currentDocument?.title}
        selectionText={selectionText ?? undefined}
        onClearSelection={selectionText ? handleClearSelection : undefined}
      />

      {/* Quick actions - shown when chat is empty */}
      {messages.length === 0 && (
        <QuickActions
          hasSelection={!!selectionText}
          onAction={handleQuickAction}
        />
      )}

      {/* Messages */}
      <ChatMessages
        messages={messages}
        isStreaming={isStreaming}
      />

      {/* Error display */}
      {error && (
        <div className="px-3 py-2 mx-3 mb-2 rounded bg-mythos-accent-red/10 border border-mythos-accent-red/30">
          <p className="text-xs text-mythos-accent-red">{error}</p>
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        isStreaming={isStreaming}
        placeholder={
          selectionText
            ? "Ask about the selection..."
            : "Ask about your story..."
        }
      />
    </div>
  );
}
