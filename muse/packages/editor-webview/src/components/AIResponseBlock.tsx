/**
 * AIResponseBlock - Notion-style AI response block in editor
 * Shows streaming response with actions: Insert below, Replace, Retry, Discard
 */

import { useState, useCallback, useRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AIBlockStatus = 'idle' | 'streaming' | 'complete' | 'error';

interface AIResponseBlockProps {
  status: AIBlockStatus;
  response: string;
  onInsertBelow: (text: string) => void;
  onRetry: () => void;
  onDiscard: () => void;
  onFollowUp: (prompt: string) => void;
  onStop?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Standalone AI Response Block (for inline use)
// ─────────────────────────────────────────────────────────────────────────────

export function AIResponseBlock({
  status,
  response,
  onInsertBelow,
  onRetry,
  onDiscard,
  onFollowUp,
  onStop,
}: AIResponseBlockProps) {
  const [followUpQuery, setFollowUpQuery] = useState('');
  const [showScopeDropdown, setShowScopeDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFollowUp = useCallback(() => {
    if (followUpQuery.trim()) {
      onFollowUp(followUpQuery.trim());
      setFollowUpQuery('');
    }
  }, [followUpQuery, onFollowUp]);

  const isStreaming = status === 'streaming';
  const hasResponse = response && response.length > 0;
  const isComplete = status === 'complete';

  return (
    <div className="ai-response-block">
      {/* Header with Avatar and Status */}
      <div className="ai-response-header">
        <div className="ai-response-avatar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M7 8.5C8.5 7 11 6.5 12 6.5C13 6.5 15.5 7 17 8.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <circle cx="9" cy="12" r="1.5" fill="currentColor" />
            <path
              d="M14 11C14 11 15 10.5 16 11.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M10 17C11 18 13 18 14 17"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Content Area */}
        <div className="ai-response-content">
          {/* Streaming State */}
          {isStreaming && !hasResponse && (
            <div className="ai-response-thinking">
              <span className="ai-thinking-text">Thinking</span>
              <span className="ai-thinking-dots">
                <span className="ai-dot ai-dot-1" />
                <span className="ai-dot ai-dot-2" />
                <span className="ai-dot ai-dot-3" />
              </span>
            </div>
          )}

          {/* Response Text */}
          {hasResponse && (
            <div className="ai-response-text">
              {response}
              {isStreaming && <span className="ai-cursor" />}
            </div>
          )}
        </div>

        {/* Stop Button (during streaming) */}
        {isStreaming && (
          <button className="ai-response-stop" onClick={onStop} title="Stop">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        )}
      </div>

      {/* Follow-up Input (when complete) */}
      {isComplete && (
        <div className="ai-response-followup">
          <input
            ref={inputRef}
            type="text"
            className="ai-followup-input"
            value={followUpQuery}
            onChange={(e) => setFollowUpQuery(e.target.value)}
            placeholder="Ask a follow-up..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                handleFollowUp();
                e.preventDefault();
              }
            }}
          />

          {/* Scope Dropdown */}
          <div className="ai-followup-scope-wrapper">
            <button
              className="ai-followup-scope-btn"
              onClick={() => setShowScopeDropdown(!showScopeDropdown)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <path d="M2 10h20" />
              </svg>
              <span>All Sources</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>

          {/* @ mention */}
          <button className="ai-followup-icon" title="Mention">@</button>

          {/* Feedback buttons */}
          <button className="ai-followup-icon" title="Good response">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
          </button>
          <button className="ai-followup-icon" title="Bad response">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
            </svg>
          </button>

          {/* Send */}
          <button
            className={`ai-followup-send ${followUpQuery.trim() ? 'active' : ''}`}
            onClick={handleFollowUp}
            disabled={!followUpQuery.trim()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}

      {/* Action Buttons (when complete) */}
      {isComplete && (
        <div className="ai-response-actions">
          <button className="ai-action-btn ai-action-primary" onClick={() => onInsertBelow(response)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18" />
              <path d="M12 12v6m-3-3h6" />
            </svg>
            Insert below
          </button>
          <button className="ai-action-btn" onClick={onRetry}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 4v6h6M23 20v-6h-6" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
            </svg>
            Retry
          </button>
          <button className="ai-action-btn" onClick={onDiscard}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
            Close
            <span className="ai-action-shortcut">Esc</span>
          </button>
        </div>
      )}

      <style>{`
        .ai-response-block {
          background: var(--color-bg-elevated, #fff);
          border: 1px solid var(--color-border, #e8e8e6);
          border-radius: var(--radius-xl, 16px);
          margin: 16px 0;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .ai-response-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
        }

        .ai-response-avatar {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-bg-surface, #f7f7f5);
          border: 1px solid var(--color-border, #e8e8e6);
          border-radius: 50%;
          color: var(--color-text, #37352f);
        }

        .ai-response-content {
          flex: 1;
          min-width: 0;
          padding-top: 4px;
        }

        .ai-response-thinking {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--color-text-secondary, #6b6b6b);
          font-size: 14px;
        }

        .ai-thinking-text {
          font-weight: 500;
        }

        .ai-thinking-dots {
          display: flex;
          gap: 3px;
        }

        .ai-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          animation: dotPulse 1.4s ease-in-out infinite;
        }

        .ai-dot-1 {
          background: #f59e0b;
          animation-delay: 0s;
        }

        .ai-dot-2 {
          background: #ef4444;
          animation-delay: 0.2s;
        }

        .ai-dot-3 {
          background: #3b82f6;
          animation-delay: 0.4s;
        }

        @keyframes dotPulse {
          0%, 80%, 100% {
            opacity: 0.4;
            transform: scale(1);
          }
          40% {
            opacity: 1;
            transform: scale(1.2);
          }
        }

        .ai-response-text {
          font-size: 15px;
          line-height: 1.6;
          color: var(--color-text, #37352f);
          white-space: pre-wrap;
        }

        .ai-cursor {
          display: inline-block;
          width: 2px;
          height: 1.1em;
          background: var(--color-accent, #2eaadc);
          margin-left: 2px;
          vertical-align: text-bottom;
          animation: cursorBlink 1s step-end infinite;
        }

        @keyframes cursorBlink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }

        .ai-response-stop {
          flex-shrink: 0;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: var(--color-bg-hover, #f1f1ef);
          border-radius: 50%;
          color: var(--color-text-secondary, #6b6b6b);
          cursor: pointer;
          transition: all 0.15s;
        }

        .ai-response-stop:hover {
          background: var(--color-bg-active, #e8e8e6);
          color: var(--color-text, #37352f);
        }

        /* Follow-up Input */
        .ai-response-followup {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          border-top: 1px solid var(--color-border-subtle, #f1f1ef);
          background: var(--color-bg-surface, #f7f7f5);
        }

        .ai-followup-input {
          flex: 1;
          min-width: 0;
          border: none;
          background: transparent;
          font-size: 14px;
          color: var(--color-text, #37352f);
          outline: none;
        }

        .ai-followup-input::placeholder {
          color: var(--color-text-ghost, #c7c7c5);
        }

        .ai-followup-scope-wrapper {
          position: relative;
        }

        .ai-followup-scope-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border: none;
          background: transparent;
          border-radius: var(--radius-sm, 4px);
          font-size: 12px;
          color: var(--color-text-secondary, #6b6b6b);
          cursor: pointer;
          white-space: nowrap;
        }

        .ai-followup-scope-btn:hover {
          background: var(--color-bg-hover, #f1f1ef);
        }

        .ai-followup-icon {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: transparent;
          border-radius: var(--radius-sm, 4px);
          font-size: 14px;
          font-weight: 500;
          color: var(--color-text-muted, #9b9a97);
          cursor: pointer;
        }

        .ai-followup-icon:hover {
          background: var(--color-bg-hover, #f1f1ef);
          color: var(--color-text-secondary, #6b6b6b);
        }

        .ai-followup-send {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: var(--color-bg-hover, #e8e8e6);
          border-radius: 50%;
          color: var(--color-text-muted, #9b9a97);
          cursor: pointer;
          transition: all 0.15s;
        }

        .ai-followup-send:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .ai-followup-send.active {
          background: var(--color-accent, #2eaadc);
          color: #fff;
        }

        /* Action Buttons */
        .ai-response-actions {
          display: flex;
          gap: 4px;
          padding: 8px 16px 12px;
          background: var(--color-bg-surface, #f7f7f5);
        }

        .ai-action-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border: none;
          background: transparent;
          border-radius: var(--radius-md, 8px);
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-secondary, #6b6b6b);
          cursor: pointer;
          transition: background 0.15s;
        }

        .ai-action-btn:hover {
          background: var(--color-bg-hover, #e8e8e6);
          color: var(--color-text, #37352f);
        }

        .ai-action-btn.ai-action-primary {
          color: var(--color-text, #37352f);
        }

        .ai-action-shortcut {
          font-size: 11px;
          color: var(--color-text-muted, #9b9a97);
          margin-left: 4px;
        }

        /* Add Image Button */
        .ai-response-block + .ai-add-image {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: var(--color-bg-surface, #f7f7f5);
          border: 1px dashed var(--color-border, #e8e8e6);
          border-radius: var(--radius-lg, 12px);
          margin-top: -8px;
          font-size: 14px;
          color: var(--color-text-secondary, #6b6b6b);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

export default AIResponseBlock;
