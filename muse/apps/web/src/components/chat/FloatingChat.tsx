/**
 * FloatingChat
 *
 * Unified Notion-style floating AI chat panel.
 * Supports both trial (anonymous) and authenticated modes via `variant` prop.
 *
 * - variant="full" (default): Full features with sessions, mode toggle, tools
 * - variant="trial": Limited features with trial counter, signup CTA
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  ChevronDown,
  PanelRightClose,
  Minus,
  ExternalLink,
  Check,
  Plus,
  Trash2,
  History,
} from "lucide-react";
import { cn, Button, ScrollArea } from "@mythos/ui";
import { bg, text, border, accent } from "@mythos/theme";
import {
  useMythosStore,
  useChatMessages,
  useIsChatStreaming,
  useChatError,
  useConversationId,
  useConversationName,
  useIsNewConversation,
  useChatMode,
  type ChatMention,
} from "../../stores";
import {
  useRemainingChatMessages,
  useIsTrialExhausted,
  useAnonymousStore,
} from "../../stores/anonymous";
import { useSagaAgent } from "../../hooks/useSagaAgent";
import { useSessionHistory } from "../../hooks/useSessionHistory";
import { useEditorSelection } from "../../hooks/useEditorSelection";
import { useApiKey } from "../../hooks/useApiKey";
import { ContextBar } from "../console/AISidebar/ContextBar";
import { QuickActions } from "../console/AISidebar/QuickActions";
import { ChatMessages } from "../console/AISidebar/ChatMessages";
import { ChatInput } from "../console/AISidebar/ChatInput";
import type { Editor } from "@mythos/editor";
import type { Capability, CapabilityContext } from "@mythos/capabilities";
import {
  invokeCapability,
  type CapabilityInvokerContext,
  type ConsoleTab,
  type ModalType,
} from "../../ai/invokeCapability";

interface FloatingChatProps {
  /** "full" for authenticated users, "trial" for anonymous users */
  variant?: "full" | "trial";
  /** Callback when user clicks signup (trial mode only) */
  onSignUp?: () => void;
  className?: string;
}

// Mode dropdown item
interface ModeOption {
  value: "docked" | "floating";
  label: string;
  icon: React.ReactNode;
}

const modeOptions: ModeOption[] = [
  { value: "docked", label: "Sidebar", icon: <PanelRightClose className="w-4 h-4" /> },
  { value: "floating", label: "Floating", icon: <ExternalLink className="w-4 h-4" /> },
];

export function FloatingChat({ variant = "full", onSignUp, className }: FloatingChatProps) {
  const isTrial = variant === "trial";
  const [isOpen, setIsOpen] = useState(isTrial ? false : true);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [showSessionDropdown, setShowSessionDropdown] = useState(false);

  // Chat state
  const messages = useChatMessages();
  const isStreaming = useIsChatStreaming();
  const error = useChatError();
  const conversationId = useConversationId();
  const conversationName = useConversationName();
  const isNewConversation = useIsNewConversation();
  const chatMode = useChatMode();

  // Trial state (only used when variant="trial")
  const trialRemaining = useRemainingChatMessages();
  const isTrialExhausted = useIsTrialExhausted();
  const serverTrialLimit = useAnonymousStore((s) => s.serverTrialLimit);
  const trialLimit = serverTrialLimit ?? 5;

  const setChatMode = useMythosStore((s) => s.setChatMode);
  const setActiveTab = useMythosStore((s) => s.setActiveTab);
  const openModal = useMythosStore((s) => s.openModal);

  // Session history hook (only for full mode)
  const {
    sessions,
    sessionsLoading,
    openSession,
    sessionWriter,
  } = useSessionHistory();

  const { sendMessage, stopStreaming, clearChat, newConversation } = useSagaAgent({
    mode: "editing",
    sessionWriter: isTrial ? undefined : sessionWriter,
  });

  // Get current document and editor for context
  const currentDocument = useMythosStore((s) => s.document.currentDocument);
  const currentProject = useMythosStore((s) => s.project.currentProject);
  const editorInstance = useMythosStore((s) => s.editor.editorInstance) as Editor | null;

  // Get selection text from editor
  const selectionText = useEditorSelection(editorInstance);

  // Get API key status for capability filtering
  const { hasKey: hasApiKey } = useApiKey();

  // Build capability context
  const capabilityContext: CapabilityContext = useMemo(
    () => ({
      hasProject: !!currentProject,
      selectionText: selectionText ?? undefined,
      documentTitle: currentDocument?.title,
      genre: undefined,
    }),
    [currentProject, selectionText, currentDocument?.title]
  );

  // Handle message send
  const handleSend = useCallback(
    (content: string, mentions: ChatMention[]) => {
      if (isTrial && isTrialExhausted) return;
      sendMessage(content, mentions);
    },
    [sendMessage, isTrial, isTrialExhausted]
  );

  // Handle capability invocation
  const handleCapabilityInvoke = useCallback(
    async (capability: Capability) => {
      if (isTrial && isTrialExhausted) return;
      const invokerContext: CapabilityInvokerContext = {
        capabilityContext,
        setActiveTab: (tab: ConsoleTab) => setActiveTab(tab),
        openModal: (modal: ModalType, payload?: unknown) => {
          const modalPayload = payload as Record<string, unknown> | undefined;
          openModal({ type: modal, ...modalPayload } as Parameters<typeof openModal>[0]);
        },
        sendChatPrompt: (prompt: string) => sendMessage(prompt, []),
      };
      await invokeCapability(capability, invokerContext);
    },
    [capabilityContext, sendMessage, setActiveTab, openModal, isTrial, isTrialExhausted]
  );

  // Handle clear selection
  const handleClearSelection = useCallback(() => {
    if (editorInstance) {
      const pos = editorInstance.state.selection.from;
      editorInstance.commands.setTextSelection(pos);
    }
  }, [editorInstance]);

  // Handle mode change (full mode only)
  const handleModeChange = useCallback(
    (mode: "docked" | "floating") => {
      setChatMode(mode);
      setShowModeDropdown(false);
      if (mode === "docked") {
        setActiveTab("chat");
      }
    },
    [setChatMode, setActiveTab]
  );

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowModeDropdown(false);
      setShowSessionDropdown(false);
    };
    if (showModeDropdown || showSessionDropdown) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showModeDropdown, showSessionDropdown]);

  // Session display name
  const sessionDisplayName = conversationName || (isNewConversation ? "New Chat" : "Conversation");

  // Document title for context display
  const documentTitle = currentDocument?.title || "Untitled";

  return (
    <div className={cn("fixed bottom-5 right-5 z-50", className)}>
      <AnimatePresence mode="wait">
        {isOpen ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className={cn(
              "flex flex-col rounded-2xl overflow-hidden",
              isTrial ? "w-[380px] h-[600px]" : "w-[400px] h-[600px]"
            )}
            style={{
              background: bg.primary,
              border: `1px solid ${border.default}`,
              boxShadow:
                "0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.03)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ background: bg.secondary, borderBottom: `1px solid ${border.subtle}` }}
            >
              {/* Left side: Session dropdown (full) or title (trial) */}
              {isTrial ? (
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-medium" style={{ color: text.primary }}>Mythos AI</span>
                  <ChevronDown className="w-4 h-4" style={{ color: text.secondary }} />
                </div>
              ) : (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSessionDropdown(!showSessionDropdown);
                      setShowModeDropdown(false);
                    }}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                  >
                    <span className="text-[15px] font-medium truncate max-w-[140px]" style={{ color: text.primary }}>
                      {sessionDisplayName}
                    </span>
                    <ChevronDown className="w-4 h-4" style={{ color: text.secondary }} />
                  </button>

                  {/* Session dropdown menu */}
                  {showSessionDropdown && (
                    <div
                      className="absolute top-full left-0 mt-1 w-64 rounded-lg shadow-xl z-50 overflow-hidden"
                      style={{ background: bg.tertiary, border: `1px solid ${border.default}` }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ borderBottom: `1px solid ${border.subtle}` }} className="px-3 py-2">
                        <span className="text-xs" style={{ color: text.secondary }}>Recent Chats</span>
                      </div>
                      <ScrollArea className="max-h-48">
                        {sessionsLoading ? (
                          <div className="px-3 py-4 text-center text-xs" style={{ color: text.secondary }}>
                            Loading...
                          </div>
                        ) : sessions.length === 0 ? (
                          <div className="px-3 py-4 text-center text-xs" style={{ color: text.secondary }}>
                            No previous chats
                          </div>
                        ) : (
                          sessions.slice(0, 5).map((session) => (
                            <button
                              key={session.id}
                              onClick={() => {
                                openSession(session.id);
                                setShowSessionDropdown(false);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                              style={session.id === conversationId ? { background: border.subtle } : undefined}
                            >
                              <History className="w-3.5 h-3.5 shrink-0" style={{ color: text.secondary }} />
                              <span className="text-sm truncate flex-1" style={{ color: text.primary }}>
                                {session.name || "Unnamed"}
                              </span>
                              {session.id === conversationId && (
                                <Check className="w-3.5 h-3.5" style={{ color: accent.primary }} />
                              )}
                            </button>
                          ))
                        )}
                      </ScrollArea>
                    </div>
                  )}
                </div>
              )}

              {/* Window controls */}
              <div className="flex items-center gap-0.5">
                {/* Mode toggle dropdown (full mode only) */}
                {!isTrial && (
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowModeDropdown(!showModeDropdown);
                        setShowSessionDropdown(false);
                      }}
                      className="p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.06)] transition-colors"
                      title="Switch mode"
                    >
                      <PanelRightClose className="w-4 h-4" style={{ color: text.secondary }} />
                    </button>

                    {/* Mode dropdown menu */}
                    {showModeDropdown && (
                      <div
                        className="absolute top-full right-0 mt-1 w-36 rounded-lg shadow-xl z-50 overflow-hidden"
                        style={{ background: bg.tertiary, border: `1px solid ${border.default}` }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {modeOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => handleModeChange(option.value)}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[rgba(255,255,255,0.06)] text-left transition-colors"
                          >
                            {option.icon}
                            <span className="text-sm" style={{ color: text.primary }}>{option.label}</span>
                            {chatMode === option.value && (
                              <Check className="w-3.5 h-3.5 ml-auto" style={{ color: accent.primary }} />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* New conversation (full mode only) */}
                {!isTrial && (
                  <button
                    onClick={newConversation}
                    className="p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.06)] transition-colors"
                    title="New chat"
                  >
                    <Plus className="w-4 h-4" style={{ color: text.secondary }} />
                  </button>
                )}

                {/* Clear (full mode only) */}
                {!isTrial && messages.length > 0 && (
                  <button
                    onClick={clearChat}
                    className="p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.06)] transition-colors"
                    title="Clear messages"
                  >
                    <Trash2 className="w-4 h-4" style={{ color: text.secondary }} />
                  </button>
                )}

                {/* Minimize */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.06)] transition-colors"
                  title="Minimize"
                >
                  <Minus className="w-4 h-4" style={{ color: text.secondary }} />
                </button>
              </div>
            </div>

            {/* Trial exhausted state */}
            {isTrial && isTrialExhausted ? (
              <div className="p-4">
                <div className="text-center py-8">
                  <div
                    className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${accent.primaryBg} 0%, ${accent.primaryGlow} 100%)` }}
                  >
                    <Sparkles className="w-7 h-7" style={{ color: accent.primary }} />
                  </div>
                  <p className="text-[15px] font-medium mb-1" style={{ color: text.primary }}>
                    Trial complete
                  </p>
                  <p className="text-[13px] mb-5" style={{ color: text.secondary }}>
                    Sign up free to continue using AI
                  </p>
                  <button
                    onClick={onSignUp}
                    className="px-5 py-2.5 rounded-lg text-white text-[14px] font-medium transition-colors"
                    style={{ background: accent.primary }}
                  >
                    Sign up free
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Context bar (full mode only) */}
                {!isTrial && (
                  <ContextBar
                    documentTitle={documentTitle}
                    selectionText={selectionText ?? undefined}
                    onClearSelection={selectionText ? handleClearSelection : undefined}
                  />
                )}

                {/* Quick actions when empty */}
                {messages.length === 0 && (
                  <div className="px-4 py-3 flex-1 overflow-y-auto min-h-0">
                    <QuickActions
                      hasSelection={!!selectionText}
                      hasApiKey={hasApiKey}
                      onInvoke={handleCapabilityInvoke}
                      className="px-0"
                    />
                  </div>
                )}

                {/* Messages - only show when there are messages (empty state is in welcome section above) */}
                {messages.length > 0 && (
                  <ChatMessages
                    messages={messages}
                    isStreaming={isStreaming}
                    className="flex-1 min-h-0"
                  />
                )}

                {/* Error display */}
                {error && (
                  <div className="px-4 py-2">
                    <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
                      <p className="text-xs text-red-400">{error}</p>
                    </div>
                  </div>
                )}

                {/* Stop button when streaming */}
                {isStreaming && (
                  <div className="px-4 py-2 border-t border-[rgba(255,255,255,0.06)]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={stopStreaming}
                      className="w-full text-xs text-red-400 hover:bg-red-500/10"
                    >
                      Stop generating
                    </Button>
                  </div>
                )}

                {/* Input */}
                <ChatInput
                  onSend={handleSend}
                  isStreaming={isStreaming}
                  placeholder={
                    selectionText ? "Ask about the selection..." : "Ask, search, or create..."
                  }
                  variant="notion"
                  documentTitle={documentTitle}
                  className="border-t border-[rgba(255,255,255,0.06)]"
                />
                {/* Trial counter */}
                {isTrial && (
                  <div className="px-4 pb-3 -mt-2 flex items-center justify-between text-xs" style={{ color: text.muted }}>
                    <span>{trialRemaining}/{trialLimit} messages remaining</span>
                  </div>
                )}
              </>
            )}
          </motion.div>
        ) : (
          /* Collapsed button - floating orb */
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsOpen(true)}
            className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow"
            style={{
              background: `linear-gradient(135deg, ${accent.primary} 0%, ${accent.primaryHover} 100%)`,
              boxShadow: `0 8px 24px ${accent.primaryBg}, 0 2px 8px rgba(0,0,0,0.2)`,
            }}
          >
            <Sparkles className="w-5 h-5 text-white" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FloatingChat;
