import { useState, useCallback, useRef, useMemo, useEffect, type KeyboardEvent } from "react";
import { Send, AtSign, X, FileText, Paperclip, Globe, ArrowUp } from "lucide-react";
import { Button, cn } from "@mythos/ui";
import { bg, text, border, accent } from "@mythos/theme";
import { useShallow } from "zustand/react/shallow";
import { useMythosStore, type ChatMention } from "../../../stores";

interface ChatInputProps {
  onSend: (message: string, mentions: ChatMention[]) => void;
  isStreaming: boolean;
  placeholder?: string;
  /** Notion-style input for floating chat */
  variant?: "default" | "notion";
  /** Document title for context chip (notion variant) */
  documentTitle?: string;
  className?: string;
}

interface MentionCandidate {
  type: "entity" | "document";
  id: string;
  name: string;
  entityType?: string;
}

export function ChatInput({
  onSend,
  isStreaming,
  placeholder = "Ask about your story...",
  variant = "default",
  documentTitle,
  className,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [mentions, setMentions] = useState<ChatMention[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatDraft = useMythosStore((s) => s.chat.draft);
  const setChatDraft = useMythosStore((s) => s.setChatDraft);

  // Get entity and document IDs for stable dependency tracking
  const entitiesMap = useMythosStore((s) => s.world.entities);
  const documents = useMythosStore(useShallow((s) => s.document.documents));

  // Memoize entities array from map
  const entityIds = useMemo(() => Array.from(entitiesMap.keys()).join(","), [entitiesMap]);
  const entities = useMemo(
    () => Array.from(entitiesMap.values()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entityIds]
  );

  useEffect(() => {
    if (!chatDraft) return;
    setInput((prev) => (prev.trim().length === 0 ? chatDraft : prev));
    setChatDraft("");
    inputRef.current?.focus();
  }, [chatDraft, setChatDraft]);

  // Build mention candidates (memoized)
  const candidates: MentionCandidate[] = useMemo(() => [
    ...entities.map((e) => ({
      type: "entity" as const,
      id: e.id,
      name: e.name,
      entityType: e.type,
    })),
    ...documents.map((d) => ({
      type: "document" as const,
      id: d.id,
      name: d.title ?? "Untitled",
    })),
  ], [entities, documents]);

  // Filter candidates by query
  const filteredCandidates = mentionQuery
    ? candidates.filter((c) =>
        c.name.toLowerCase().includes(mentionQuery.toLowerCase())
      ).slice(0, 8)
    : candidates.slice(0, 8);

  // Handle input change - detect @ mentions
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    // Check for @ at end of input
    const lastAtIndex = value.lastIndexOf("@");
    if (lastAtIndex !== -1 && lastAtIndex === value.length - 1) {
      setShowMentions(true);
      setMentionQuery("");
      setSelectedIndex(0);
    } else if (lastAtIndex !== -1) {
      // Check if we're typing a mention
      const afterAt = value.slice(lastAtIndex + 1);
      const hasSpace = afterAt.includes(" ");
      if (!hasSpace) {
        setShowMentions(true);
        setMentionQuery(afterAt);
        setSelectedIndex(0);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  }, []);

  // Handle mention selection
  const handleSelectMention = useCallback((candidate: MentionCandidate) => {
    const lastAtIndex = input.lastIndexOf("@");
    const newInput = input.slice(0, lastAtIndex) + `@${candidate.name} `;
    setInput(newInput);
    setMentions((prev) => [
      ...prev,
      { type: candidate.type, id: candidate.id, name: candidate.name },
    ]);
    setShowMentions(false);
    inputRef.current?.focus();
  }, [input]);

  // Handle keyboard navigation in mentions dropdown
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && filteredCandidates.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filteredCandidates.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filteredCandidates.length) % filteredCandidates.length);
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSelectMention(filteredCandidates[selectedIndex]);
      } else if (e.key === "Escape") {
        setShowMentions(false);
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [showMentions, filteredCandidates, selectedIndex, handleSelectMention]);

  // Handle send
  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed, mentions);
    setInput("");
    setMentions([]);
  }, [input, mentions, isStreaming, onSend]);

  // Remove a mention
  const removeMention = useCallback((id: string) => {
    setMentions((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // Trigger @ mention
  const triggerMention = useCallback(() => {
    setInput((prev) => prev + "@");
    setShowMentions(true);
    setMentionQuery("");
    setSelectedIndex(0);
    inputRef.current?.focus();
  }, []);

  // Notion-style input variant
  if (variant === "notion") {
    return (
      <div className={cn("px-4 pb-4 pt-3", className)} style={{ background: bg.secondary }}>
        {/* Active mentions */}
        {mentions.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {mentions.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
                style={{ background: accent.primaryBg, color: accent.primary }}
              >
                @{m.name}
                <button
                  onClick={() => removeMention(m.id)}
                  className="hover:text-white transition-colors"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Input container with blue focus border */}
        <div
          className="rounded-xl overflow-hidden transition-all"
          style={{
            background: bg.primary,
            border: isFocused ? `2px solid ${accent.primary}` : `2px solid ${border.default}`,
            boxShadow: isFocused ? `0 0 0 3px ${accent.primaryGlow}` : undefined,
          }}
        >
          {/* Top row: @ button + document context chip */}
          <div className="px-3 pt-3 pb-2 flex items-center gap-2">
            <button
              onClick={triggerMention}
              className="p-1 rounded hover:bg-[rgba(255,255,255,0.06)] transition-colors"
              title="Mention entity"
            >
              <AtSign className="w-4 h-4" style={{ color: text.secondary }} />
            </button>
            {documentTitle && (
              <div
                className="flex items-center gap-1.5 px-2 py-1 rounded-md"
                style={{ background: border.subtle }}
              >
                <FileText className="w-3.5 h-3.5" style={{ color: text.secondary }} />
                <span className="text-[13px] truncate max-w-[180px]" style={{ color: text.primary }}>
                  {documentTitle}
                </span>
              </div>
            )}
          </div>

          {/* Text input */}
          <div className="px-3 pb-2 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholder}
              disabled={isStreaming}
              rows={1}
              className={cn(
                "w-full bg-transparent text-[14px]",
                "focus:outline-none resize-none",
                "disabled:opacity-50"
              )}
              style={{
                minHeight: "24px",
                color: text.primary,
                caretColor: accent.primary,
              }}
              data-testid="chat-input"
            />

            {/* Mention dropdown */}
            {showMentions && filteredCandidates.length > 0 && (
              <div
                className="absolute bottom-full left-0 right-0 mb-1 rounded-lg shadow-lg overflow-hidden z-10"
                style={{ background: bg.tertiary, border: `1px solid ${border.default}` }}
              >
                {filteredCandidates.map((candidate, index) => (
                  <button
                    key={candidate.id}
                    onClick={() => handleSelectMention(candidate)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                    style={{
                      background: index === selectedIndex ? border.subtle : undefined,
                      color: index === selectedIndex ? text.primary : text.secondary,
                    }}
                  >
                    <AtSign className="w-3.5 h-3.5" style={{ color: text.secondary }} />
                    <span className="flex-1 truncate">{candidate.name}</span>
                    <span className="text-[10px] capitalize" style={{ color: text.muted }}>
                      {candidate.entityType ?? candidate.type}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer with options */}
          <div className="px-3 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button className="p-1 rounded hover:bg-[rgba(255,255,255,0.06)] transition-colors" title="Attach file">
                <Paperclip className="w-4 h-4" style={{ color: text.secondary }} />
              </button>
              <button
                className="flex items-center gap-1.5 text-[13px] hover:text-[#E3E2E0] transition-colors"
                style={{ color: text.secondary }}
              >
                <span>Auto</span>
              </button>
              <button
                className="flex items-center gap-1.5 text-[13px] hover:text-[#E3E2E0] transition-colors"
                style={{ color: text.secondary }}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>All Sources</span>
              </button>
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
              style={{
                background: input.trim() && !isStreaming ? accent.primary : border.default,
                color: input.trim() && !isStreaming ? "white" : text.muted,
              }}
              data-testid="chat-send"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn("px-3 py-2 border-t border-mythos-border-default", className)}>
      {/* Active mentions */}
      {mentions.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {mentions.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-mythos-accent-purple/20 text-mythos-accent-purple"
            >
              @{m.name}
              <button
                onClick={() => removeMention(m.id)}
                className="hover:text-mythos-text-primary"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="relative">
        <textarea
          ref={inputRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isStreaming}
          rows={2}
          className={cn(
            "w-full resize-none bg-mythos-bg-tertiary rounded-lg px-3 py-2 pr-10",
            "text-sm text-mythos-text-primary placeholder:text-mythos-text-muted",
            "border border-mythos-border-default focus:border-mythos-accent-purple/50",
            "focus:outline-none focus:ring-1 focus:ring-mythos-accent-purple/30",
            "disabled:opacity-50"
          )}
          data-testid="chat-input"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSend}
          disabled={!input.trim() || isStreaming}
          className="absolute right-1 bottom-1 h-7 w-7"
          data-testid="chat-send"
        >
          <Send className="w-4 h-4" />
        </Button>

        {/* Mention dropdown */}
        {showMentions && filteredCandidates.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-mythos-bg-secondary border border-mythos-border-default rounded-lg shadow-lg overflow-hidden z-10">
            {filteredCandidates.map((candidate, index) => (
              <button
                key={candidate.id}
                onClick={() => handleSelectMention(candidate)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-left text-sm",
                  index === selectedIndex
                    ? "bg-mythos-bg-tertiary text-mythos-text-primary"
                    : "text-mythos-text-secondary hover:bg-mythos-bg-tertiary/50"
                )}
              >
                <AtSign className="w-3.5 h-3.5 text-mythos-text-muted" />
                <span className="flex-1 truncate">{candidate.name}</span>
                <span className="text-[10px] text-mythos-text-muted capitalize">
                  {candidate.entityType ?? candidate.type}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hint */}
      <div className="flex items-center justify-between mt-1.5 text-[10px] text-mythos-text-muted">
        <span>Type @ to mention entities</span>
        <span>Enter to send · Shift+Enter for new line</span>
      </div>
    </div>
  );
}
