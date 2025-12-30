import { useState, useCallback, useRef, useEffect } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Input, cn } from "@mythos/ui";

interface SessionIndicatorProps {
  /** Active conversation ID */
  conversationId: string | null;
  /** User-defined conversation name */
  conversationName: string | null;
  /** Whether this is a new conversation */
  isNewConversation: boolean;
  /** Callback when user renames the conversation */
  onRename: (name: string | null) => void | Promise<void>;
  className?: string;
}

/**
 * Session indicator with inline rename capability.
 * Shows conversation status (new vs continuing) and allows renaming.
 */
export function SessionIndicator({
  conversationId,
  conversationName,
  isNewConversation,
  onRename,
  className,
}: SessionIndicatorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Compute display name
  const idShort = conversationId?.split("-")[0] ?? "—";
  const displayName =
    conversationName?.trim() ||
    (isNewConversation ? "New conversation" : `Session ${idShort}`);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const startEditing = useCallback(() => {
    setDraft(conversationName ?? "");
    setIsEditing(true);
  }, [conversationName]);

  const confirmEdit = useCallback(() => {
    const trimmed = draft.trim();
    onRename(trimmed || null);
    setIsEditing(false);
  }, [draft, onRename]);

  const cancelEdit = useCallback(() => {
    setDraft(conversationName ?? "");
    setIsEditing(false);
  }, [conversationName]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        confirmEdit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      }
    },
    [confirmEdit, cancelEdit]
  );

  if (isEditing) {
    return (
      <div className={cn("flex items-center gap-1 min-w-0", className)}>
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={confirmEdit}
          placeholder="Name this conversation..."
          className="h-6 px-2 text-xs flex-1 min-w-0"
        />
        <button
          type="button"
          onClick={confirmEdit}
          className="p-0.5 rounded hover:bg-mythos-text-muted/10 text-mythos-accent-green"
          title="Confirm"
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={cancelEdit}
          className="p-0.5 rounded hover:bg-mythos-text-muted/10 text-mythos-text-muted"
          title="Cancel"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1.5 min-w-0", className)}>
      {/* Status dot */}
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full flex-shrink-0",
          isNewConversation
            ? "bg-mythos-text-muted/50"
            : "bg-mythos-accent-green"
        )}
        title={isNewConversation ? "New conversation" : "Continuing"}
      />

      {/* Display name (truncated) */}
      <span
        className="text-sm font-medium text-mythos-text-primary truncate cursor-pointer hover:text-mythos-text-secondary"
        onClick={startEditing}
        title={`${displayName} (click to rename)`}
      >
        {displayName}
      </span>

      {/* Edit button */}
      <button
        type="button"
        onClick={startEditing}
        className="p-0.5 rounded hover:bg-mythos-text-muted/10 text-mythos-text-muted flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Rename conversation"
      >
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  );
}
