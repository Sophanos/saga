/**
 * ChatPanel
 *
 * Unified AI chat panel for Mythos IDE.
 * Works in both docked (sidebar) and floating (overlay) modes.
 *
 * Modes:
 * - "docked": Fills parent container in Console sidebar
 * - "floating": Fixed overlay with minimize to orb
 *
 * Variants:
 * - "full": Full features for authenticated users
 * - "trial": Limited features for anonymous users
 */

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles } from "lucide-react";
import { cn, Button } from "@mythos/ui";
import { bg, text, border, accent } from "@mythos/theme";
import type { ChatAttachment } from "@mythos/ai/hooks";
import {
  useMythosStore,
  useChatMessages,
  useIsChatStreaming,
  useChatError,
  useConversationId,
  useConversationName,
  useIsNewConversation,
  useLinterIssueCounts,
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
import { useAIQuotaGuard, useQuotaGuard, useUsageWarning } from "../../hooks/useQuotaGuard";
import { ContextBar } from "../console/AISidebar/ContextBar";
import { QuickActions } from "../console/AISidebar/QuickActions";
import { ChatMessages } from "../console/AISidebar/ChatMessages";
import { ChatInput } from "../console/AISidebar/ChatInput";
import { ChatHeader, type ChatPanelMode } from "./ChatHeader";
import type { Editor } from "@mythos/editor";
import type { Capability, CapabilityContext } from "@mythos/capabilities";
import {
  invokeCapability,
  type CapabilityInvokerContext,
  type ConsoleTab,
  type ModalType,
} from "../../ai/invokeCapability";

export type { ChatPanelMode };

interface ChatPanelProps {
  /** Display mode: docked in sidebar or floating overlay */
  mode: ChatPanelMode;
  /** "full" for authenticated users, "trial" for anonymous users */
  variant?: "full" | "trial";
  /** Callback when user clicks signup (trial mode only) */
  onSignUp?: () => void;
  /** Callback when panel should be hidden (docked mode) */
  onHide?: () => void;
  className?: string;
}

export function ChatPanel({
  mode,
  variant = "full",
  onSignUp,
  onHide,
  className,
}: ChatPanelProps) {
  const isTrial = variant === "trial";
  const isFloating = mode === "floating";
  
  // Floating mode: track expanded/minimized state
  const [isExpanded, setIsExpanded] = useState(true);

  // Chat state from store
  const messages = useChatMessages();
  const isStreaming = useIsChatStreaming();
  const error = useChatError();
  const conversationId = useConversationId();
  const conversationName = useConversationName();
  const isNewConversation = useIsNewConversation();
  
  // Linter state for badge
  const linterCounts = useLinterIssueCounts();

  // Trial state (only used when variant="trial")
  const trialRemaining = useRemainingChatMessages();
  const isTrialExhausted = useIsTrialExhausted();
  const serverTrialLimit = useAnonymousStore((s) => s.serverTrialLimit);
  const trialLimit = serverTrialLimit ?? 5;
  const tryPayload = useAnonymousStore((s) => s.tryPayload);
  const personalization = useAnonymousStore((s) => s.personalization);

  // Store actions
  const setChatMode = useMythosStore((s) => s.setChatMode);
  const setActiveTab = useMythosStore((s) => s.setActiveTab);
  const openModal = useMythosStore((s) => s.openModal);

  // Session history hook
  const {
    sessions,
    sessionsLoading,
    openSession,
    removeSession,
    sessionWriter,
  } = useSessionHistory();

  const { sendMessage, stopStreaming, newConversation } = useSagaAgent({
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

  // Quota guards for authenticated users
  const { guard: checkAIQuota } = useAIQuotaGuard();
  const { guard: checkImageGenQuota } = useQuotaGuard("imageGen");

  // Usage warning at 80% threshold
  const { showWarning: showUsageWarning } = useUsageWarning(80);

  // Build capability context
  const capabilityContext: CapabilityContext = useMemo(
    () => ({
      hasProject: !!currentProject,
      selectionText: selectionText ?? undefined,
      documentTitle: currentDocument?.title,
      genre: personalization?.genre ?? currentProject?.config?.genre,
    }),
    [currentProject, selectionText, currentDocument?.title, personalization?.genre]
  );

  // Handle message send
  const handleSend = useCallback(
    (content: string, mentions: ChatMention[], attachments?: ChatAttachment[]) => {
      // Check quota (handles both trial and authenticated users, shows upgrade prompt if blocked)
      if (!checkAIQuota({ useToast: true })) return;
      sendMessage(content, { mentions, attachments });
      // Show usage warning if approaching limit (80%+)
      showUsageWarning();
    },
    [sendMessage, checkAIQuota, showUsageWarning]
  );

  // Handle capability invocation
  const handleCapabilityInvoke = useCallback(
    async (capability: Capability) => {
      // Check for image generation capabilities (require Pro tier)
      const isImageGen = capability.kind === "tool" &&
        ("toolName" in capability &&
         (capability.toolName === "generate_image" || capability.toolName === "edit_image"));

      if (isImageGen) {
        if (!checkImageGenQuota({ feature: "Image generation" })) return;
      } else {
        // Check general AI quota
        if (!checkAIQuota({ useToast: true, feature: capability.label })) return;
      }

      const invokerContext: CapabilityInvokerContext = {
        capabilityContext,
        setActiveTab: (tab: ConsoleTab) => setActiveTab(tab),
        openModal: (modal: ModalType, payload?: unknown) => {
          const modalPayload = payload as Record<string, unknown> | undefined;
          openModal({ type: modal, ...modalPayload } as Parameters<typeof openModal>[0]);
        },
        sendChatPrompt: (prompt: string) => sendMessage(prompt, { mentions: [] }),
      };
      await invokeCapability(capability, invokerContext);
    },
    [capabilityContext, sendMessage, setActiveTab, openModal, checkAIQuota, checkImageGenQuota]
  );

  // Handle clear selection
  const handleClearSelection = useCallback(() => {
    if (editorInstance) {
      const pos = editorInstance.state.selection.from;
      editorInstance.commands.setTextSelection(pos);
    }
  }, [editorInstance]);

  // Handle mode change
  const handleModeChange = useCallback(
    (newMode: ChatPanelMode) => {
      setChatMode(newMode);
      if (newMode === "docked") {
        setActiveTab("chat");
      }
    },
    [setChatMode, setActiveTab]
  );

  // Handle hide/minimize
  const handleHide = useCallback(() => {
    if (isFloating) {
      setIsExpanded(false);
    } else {
      onHide?.();
    }
  }, [isFloating, onHide]);

  // Handle linter badge click - switch to linter tab
  const handleLinterClick = useCallback(() => {
    if (isFloating) {
      // Switch to docked mode and open linter tab
      setChatMode("docked");
      setActiveTab("linter");
    } else {
      // Already docked, just switch tab
      setActiveTab("linter");
    }
  }, [isFloating, setChatMode, setActiveTab]);

  // Document title for context display
  const documentTitle = currentDocument?.title || "Untitled";

  // Session items for header dropdown
  const sessionItems = useMemo(
    () => sessions.map((s) => ({ id: s.id, name: s.name })),
    [sessions]
  );

  const suggestedPrompt = useMemo(() => {
    if (!currentProject) {
      return "Generate a project template for my story. Ask clarifying questions before finalizing.";
    }
    if (!isTrial) return null;
    switch (tryPayload?.goal) {
      case "proofread":
        return "Fix spelling/grammar without changing meaning. Output suggestions, not a rewrite.";
      case "world_bible":
        return "Extract entities and propose a world bible structure. No judgement.";
      case "consistency_check":
        return "Flag contradictions with quoted evidence only.";
      case "name_generator":
        return "Generate 20 names that fit this world. Group them by vibe or culture.";
      case "visualize_characters":
        return "Suggest 3 visual directions for the main character. Keep it grounded in the text.";
      case "import_organize":
      default:
        return "Split this into chapters/scenes and propose an outline. Do not invent plot.";
    }
  }, [currentProject, isTrial, tryPayload?.goal]);

  const handleSuggestedSend = useCallback(() => {
    if (!suggestedPrompt) return;
    handleSend(suggestedPrompt, []);
  }, [handleSend, suggestedPrompt]);

  // Render the chat content (shared between modes)
  const renderContent = () => (
    <>
      {/* Trial exhausted state */}
      {isTrial && isTrialExhausted ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <div
              className="w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${accent.primaryBg} 0%, ${accent.primaryGlow} 100%)`,
              }}
            >
              <Sparkles className="w-8 h-8" style={{ color: accent.primary }} />
            </div>
            <p className="text-base font-medium mb-2" style={{ color: text.primary }}>
              Trial complete
            </p>
            <p className="text-sm mb-6 max-w-[220px] mx-auto" style={{ color: text.secondary }}>
              Sign up free to continue using AI assistance
            </p>
            <button
              onClick={onSignUp}
              className="px-6 py-2.5 rounded-lg text-white text-sm font-medium transition-all hover:brightness-110 active:brightness-90"
              style={{ background: accent.primary }}
            >
              Sign up free
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Context bar - shows current doc/selection */}
          {!isTrial && (
            <ContextBar
              documentTitle={documentTitle}
              selectionText={selectionText ?? undefined}
              onClearSelection={selectionText ? handleClearSelection : undefined}
            />
          )}

          {/* Suggested prompt + quick actions when chat is empty */}
          {messages.length === 0 && (
            <div className="flex-1 overflow-y-auto min-h-0 px-3 py-3 space-y-3">
              {suggestedPrompt && (
                <div
                  className="rounded-xl border p-3"
                  style={{ borderColor: border.subtle, background: bg.secondary }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] uppercase tracking-wider" style={{ color: text.muted }}>
                      Suggested prompt
                    </span>
                    <Button variant="ghost" size="sm" onClick={handleSuggestedSend}>
                      Send
                    </Button>
                  </div>
                  <p className="text-sm" style={{ color: text.primary }}>
                    {suggestedPrompt}
                  </p>
                </div>
              )}
              <QuickActions
                hasSelection={!!selectionText}
                hasApiKey={hasApiKey}
                onInvoke={handleCapabilityInvoke}
                variant="grid"
                className="px-0"
              />
            </div>
          )}

          {/* Messages */}
          {messages.length > 0 && (
            <ChatMessages
              messages={messages}
              isStreaming={isStreaming}
              className="flex-1"
              sessionWriter={sessionWriter}
            />
          )}

          {/* Error display */}
          {error && (
            <div className="px-3 py-2">
              <div
                className="px-3 py-2.5 rounded-lg text-sm"
                style={{
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  color: "#f87171",
                }}
              >
                {error}
              </div>
            </div>
          )}

          {/* Stop button when streaming (floating mode) */}
          {isFloating && isStreaming && (
            <div className="px-3 py-2" style={{ borderTop: `1px solid ${border.subtle}` }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={stopStreaming}
                className="w-full text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10"
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
              !currentProject
                ? "Describe your project to generate a template..."
                : selectionText
                  ? "Ask about the selection..."
                  : "Ask about your story..."
            }
            variant={isFloating ? "notion" : undefined}
            documentTitle={isFloating ? documentTitle : undefined}
          />

          {/* Trial counter */}
          {isTrial && (
            <div
              className="px-4 pb-3 flex items-center text-xs"
              style={{ color: text.muted }}
            >
              <span className="tabular-nums">
                {trialRemaining}/{trialLimit} messages remaining
              </span>
            </div>
          )}
        </>
      )}
    </>
  );

  // Shared header props
  const headerProps = {
    mode,
    conversationId,
    conversationName,
    isNewConversation,
    sessions: sessionItems,
    sessionsLoading,
    linterCounts,
    onLinterClick: handleLinterClick,
    onModeChange: handleModeChange,
    onHide: handleHide,
    onNewConversation: newConversation,
    onSelectSession: openSession,
    onDeleteSession: removeSession,
    isStreaming,
    onStopStreaming: stopStreaming,
    isTrial,
  };

  // DOCKED MODE: Simple container that fills parent
  if (!isFloating) {
    return (
      <div className={cn("h-full flex flex-col", className)} style={{ background: bg.primary }}>
        <ChatHeader {...headerProps} />
        {renderContent()}
      </div>
    );
  }

  // FLOATING MODE: Fixed overlay with animations
  return (
    <div className={cn("fixed bottom-5 right-5 z-50", className)}>
      <AnimatePresence mode="wait">
        {isExpanded ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="flex flex-col rounded-2xl overflow-hidden w-[400px] h-[600px]"
            style={{
              background: bg.primary,
              border: `1px solid ${border.default}`,
              boxShadow: `
                0 0 0 1px rgba(255,255,255,0.03),
                0 4px 6px -1px rgba(0,0,0,0.3),
                0 20px 40px -8px rgba(0,0,0,0.5),
                inset 0 1px 0 rgba(255,255,255,0.03)
              `,
            }}
          >
            <ChatHeader {...headerProps} />
            {renderContent()}
          </motion.div>
        ) : (
          /* Collapsed: Floating orb button */
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            onClick={() => setIsExpanded(true)}
            className="relative w-12 h-12 rounded-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${accent.primary} 0%, ${accent.primaryHover} 100%)`,
              boxShadow: `
                0 4px 12px ${accent.primaryBg},
                0 8px 24px rgba(0,0,0,0.3),
                inset 0 1px 0 rgba(255,255,255,0.2)
              `,
            }}
          >
            <Sparkles className="w-5 h-5 text-white" />
            {/* Linter indicator dot on orb */}
            {linterCounts && linterCounts.total > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{
                  background: linterCounts.error > 0 ? "#ef4444" : linterCounts.warning > 0 ? "#f59e0b" : "#3b82f6",
                  color: "white",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                }}
              >
                {linterCounts.total > 9 ? "9+" : linterCounts.total}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ChatPanel;
