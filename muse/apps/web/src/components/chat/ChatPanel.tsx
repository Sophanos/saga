/**
 * ChatPanel
 *
 * Unified Notion-style AI chat panel that works in both docked and floating modes.
 * Combines the functionality of the old AISidebar and FloatingChat into one component.
 *
 * Modes:
 * - "docked": Renders as sidebar content, fills parent container
 * - "floating": Renders as fixed overlay with minimize to orb
 *
 * Variants:
 * - "full": Full features with sessions, mode toggle, tools
 * - "trial": Limited features for anonymous users
 */

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles } from "lucide-react";
import { cn, Button } from "@mythos/ui";
import { bg, text, border, accent } from "@mythos/theme";
import {
  useMythosStore,
  useChatMessages,
  useIsChatStreaming,
  useChatError,
  useConversationId,
  useConversationName,
  useIsNewConversation,
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

  // Trial state (only used when variant="trial")
  const trialRemaining = useRemainingChatMessages();
  const isTrialExhausted = useIsTrialExhausted();
  const serverTrialLimit = useAnonymousStore((s) => s.serverTrialLimit);
  const trialLimit = serverTrialLimit ?? 5;

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
      // Docked mode: call external hide handler or switch away from chat tab
      onHide?.();
    }
  }, [isFloating, onHide]);

  // Document title for context display
  const documentTitle = currentDocument?.title || "Untitled";

  // Session items for header dropdown
  const sessionItems = useMemo(
    () => sessions.map((s) => ({ id: s.id, name: s.name })),
    [sessions]
  );

  // Render the chat content (shared between modes)
  const renderContent = () => (
    <>
      {/* Trial exhausted state */}
      {isTrial && isTrialExhausted ? (
        <div className="p-4 flex-1 flex items-center justify-center">
          <div className="text-center py-8">
            <div
              className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${accent.primaryBg} 0%, ${accent.primaryGlow} 100%)`,
              }}
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
          {/* Context bar */}
          {!isTrial && (
            <ContextBar
              documentTitle={documentTitle}
              selectionText={selectionText ?? undefined}
              onClearSelection={selectionText ? handleClearSelection : undefined}
            />
          )}

          {/* Quick actions when empty */}
          {messages.length === 0 && (
            <div className={cn("flex-1 overflow-y-auto min-h-0", isFloating ? "px-4 py-3" : "")}>
              <QuickActions
                hasSelection={!!selectionText}
                hasApiKey={hasApiKey}
                onInvoke={handleCapabilityInvoke}
                variant={isFloating ? "list" : "grid"}
                className={isFloating ? "px-0" : undefined}
              />
            </div>
          )}

          {/* Messages */}
          {messages.length > 0 && (
            <ChatMessages
              messages={messages}
              isStreaming={isStreaming}
              className="flex-1 min-h-0"
            />
          )}

          {/* Error display */}
          {error && (
            <div className={cn("py-2", isFloating ? "px-4" : "px-3")}>
              <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            </div>
          )}

          {/* Stop button when streaming (floating mode shows in body) */}
          {isFloating && isStreaming && (
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
              selectionText ? "Ask about the selection..." : "Ask about your story..."
            }
            variant={isFloating ? "notion" : undefined}
            documentTitle={isFloating ? documentTitle : undefined}
            className={isFloating ? "border-t border-[rgba(255,255,255,0.06)]" : undefined}
          />

          {/* Trial counter */}
          {isTrial && (
            <div
              className="px-4 pb-3 -mt-2 flex items-center justify-between text-xs"
              style={{ color: text.muted }}
            >
              <span>
                {trialRemaining}/{trialLimit} messages remaining
              </span>
            </div>
          )}
        </>
      )}
    </>
  );

  // DOCKED MODE: Simple container that fills parent
  if (!isFloating) {
    return (
      <div className={cn("h-full flex flex-col", className)}>
        <ChatHeader
          mode="docked"
          conversationId={conversationId}
          conversationName={conversationName}
          isNewConversation={isNewConversation}
          sessions={sessionItems}
          sessionsLoading={sessionsLoading}
          onModeChange={handleModeChange}
          onHide={handleHide}
          onNewConversation={newConversation}
          onSelectSession={openSession}
          onDeleteSession={removeSession}
          isStreaming={isStreaming}
          onStopStreaming={stopStreaming}
          isTrial={isTrial}
          className="group"
        />
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
            <ChatHeader
              mode="floating"
              conversationId={conversationId}
              conversationName={conversationName}
              isNewConversation={isNewConversation}
              sessions={sessionItems}
              sessionsLoading={sessionsLoading}
              onModeChange={handleModeChange}
              onHide={handleHide}
              onNewConversation={newConversation}
              onSelectSession={openSession}
              onDeleteSession={removeSession}
              isStreaming={isStreaming}
              onStopStreaming={stopStreaming}
              isTrial={isTrial}
            />
            {renderContent()}
          </motion.div>
        ) : (
          /* Collapsed: Floating orb button */
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsExpanded(true)}
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

export default ChatPanel;
