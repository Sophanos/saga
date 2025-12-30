/**
 * FloatingAIChat
 *
 * Notion-style floating AI chat popup for trial users.
 * Matches Notion's AI chat UI: input at bottom, document context, clean layout.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  X,
  ArrowUp,
  FileText,
  AtSign,
  Minimize2,
  ExternalLink,
  ChevronDown,
  Wand2,
  Users,
  MapPin,
  Search,
} from "lucide-react";
import {
  useRemainingChatMessages,
  useIsTrialExhausted,
  useAnonymousStore,
} from "../../stores/anonymous";
import { useMythosStore } from "../../stores";

interface FloatingAIChatProps {
  onSignUp: () => void;
  onSendMessage?: (message: string) => void;
}

interface QuickAction {
  icon: React.ReactNode;
  label: string;
  prompt: string;
}

const quickActions: QuickAction[] = [
  {
    icon: <Users className="w-4 h-4" />,
    label: "Find characters",
    prompt: "Analyze my text and identify all the characters mentioned.",
  },
  {
    icon: <MapPin className="w-4 h-4" />,
    label: "Map locations",
    prompt: "Find all the locations and settings in my story.",
  },
  {
    icon: <Wand2 className="w-4 h-4" />,
    label: "Check consistency",
    prompt: "Check my story for any consistency issues or contradictions.",
  },
];

export function FloatingAIChat({ onSignUp, onSendMessage }: FloatingAIChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea based on content
  const adjustTextareaHeight = useCallback(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, []);

  const remaining = useRemainingChatMessages();
  const isExhausted = useIsTrialExhausted();
  const serverTrialLimit = useAnonymousStore((s) => s.serverTrialLimit);
  const limit = serverTrialLimit ?? 5;

  // Get current document title for context (select primitive for reliable updates)
  const documentTitle = useMythosStore((s) => s.document.currentDocument?.title) || "Untitled";

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = useCallback(() => {
    if (!message.trim() || isExhausted) return;
    onSendMessage?.(message);
    setMessage("");
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  }, [message, isExhausted, onSendMessage]);

  const handleQuickAction = useCallback((action: QuickAction) => {
    if (isExhausted) return;
    onSendMessage?.(action.prompt);
  }, [isExhausted, onSendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className="fixed bottom-5 right-5 z-50">
      <AnimatePresence mode="wait">
        {isOpen ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="w-[380px] rounded-2xl bg-[#252525] border border-[#383838] shadow-2xl overflow-hidden"
            style={{
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05)"
            }}
          >
            {/* Header - Notion style */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#383838]">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-medium text-white">Mythos AI</span>
                <ChevronDown className="w-4 h-4 text-[#9B9B9B]" />
              </div>
              <div className="flex items-center gap-1">
                <button className="p-1.5 rounded-md hover:bg-[#383838] transition-colors">
                  <ExternalLink className="w-4 h-4 text-[#9B9B9B]" />
                </button>
                <button className="p-1.5 rounded-md hover:bg-[#383838] transition-colors">
                  <Minimize2 className="w-4 h-4 text-[#9B9B9B]" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-md hover:bg-[#383838] transition-colors"
                >
                  <X className="w-4 h-4 text-[#9B9B9B]" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              {isExhausted ? (
                /* Exhausted state */
                <div className="text-center py-8">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#7C5CFF]/20 to-[#5C9EFF]/20 flex items-center justify-center">
                    <Sparkles className="w-7 h-7 text-[#7C5CFF]" />
                  </div>
                  <p className="text-[15px] text-white font-medium mb-1">
                    Trial complete
                  </p>
                  <p className="text-[13px] text-[#9B9B9B] mb-5">
                    Sign up free to continue using AI
                  </p>
                  <button
                    onClick={onSignUp}
                    className="px-5 py-2.5 rounded-lg bg-white text-[#191919] text-[14px] font-medium hover:bg-white/90 transition-colors"
                  >
                    Sign up free
                  </button>
                </div>
              ) : (
                <>
                  {/* Mascot and welcome */}
                  <div className="flex flex-col items-center mb-5">
                    <div className="w-16 h-16 mb-3 rounded-full bg-gradient-to-br from-[#7C5CFF] to-[#5C9EFF] flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-[15px] font-medium text-white mb-1">
                      Your writing assistant
                    </p>
                    <p className="text-[13px] text-[#9B9B9B] text-center">
                      Ask me anything or try a quick action
                    </p>
                  </div>

                  {/* Quick actions */}
                  <div className="space-y-1 mb-4">
                    {quickActions.map((action) => (
                      <button
                        key={action.label}
                        onClick={() => handleQuickAction(action)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#303030] transition-colors text-left group"
                      >
                        <div className="p-1.5 rounded-md bg-[#303030] text-[#9B9B9B] group-hover:bg-[#383838] group-hover:text-white transition-colors">
                          {action.icon}
                        </div>
                        <span className="text-[14px] text-[#E0E0E0] group-hover:text-white transition-colors">
                          {action.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Bottom input area - Notion style */}
            {!isExhausted && (
              <div className="px-4 pb-4">
                <div
                  className="rounded-xl border-2 border-[#2D7FF9] bg-[#1E1E1E] overflow-hidden"
                  style={{ boxShadow: "0 0 0 3px rgba(45, 127, 249, 0.15)" }}
                >
                  {/* Document context chip */}
                  <div className="px-3 pt-3 pb-2 flex items-center gap-2">
                    <button className="p-1 rounded hover:bg-[#303030] transition-colors">
                      <AtSign className="w-4 h-4 text-[#9B9B9B]" />
                    </button>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#303030]">
                      <FileText className="w-3.5 h-3.5 text-[#9B9B9B]" />
                      <span className="text-[13px] text-[#E0E0E0]">{documentTitle}</span>
                    </div>
                  </div>

                  {/* Text input */}
                  <div className="px-3 pb-2">
                    <textarea
                      ref={inputRef}
                      value={message}
                      onChange={(e) => {
                        setMessage(e.target.value);
                        adjustTextareaHeight();
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask, search, or create..."
                      rows={1}
                      className="w-full bg-transparent text-[14px] text-white placeholder:text-[#6B6B6B] focus:outline-none resize-none selection:bg-[#2D7FF9]/30 selection:text-white caret-[#2D7FF9]"
                      style={{ minHeight: "24px" }}
                    />
                  </div>

                  {/* Footer with options */}
                  <div className="px-3 pb-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button className="flex items-center gap-1.5 text-[13px] text-[#9B9B9B] hover:text-white transition-colors">
                        <Search className="w-3.5 h-3.5" />
                        <span>Auto</span>
                      </button>
                      <span className="text-[12px] text-[#6B6B6B]">{remaining}/{limit}</span>
                    </div>
                    <button
                      onClick={handleSend}
                      disabled={!message.trim()}
                      className={`
                        w-8 h-8 rounded-full flex items-center justify-center transition-all
                        ${message.trim()
                          ? "bg-[#2D7FF9] text-white hover:bg-[#2D7FF9]/90"
                          : "bg-[#383838] text-[#6B6B6B]"
                        }
                      `}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          /* Collapsed button - Notion style floating orb */
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsOpen(true)}
            className="w-12 h-12 rounded-full bg-gradient-to-br from-[#7C5CFF] to-[#5C9EFF] flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow"
            style={{
              boxShadow: "0 8px 24px rgba(124, 92, 255, 0.4), 0 2px 8px rgba(0,0,0,0.2)"
            }}
          >
            <Sparkles className="w-5 h-5 text-white" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FloatingAIChat;
