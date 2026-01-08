import type { Suggestion } from '../extensions/suggestion-plugin';

interface BatchApprovalBarProps {
  suggestions: Suggestion[];
  onAcceptAll: () => void;
  onRejectAll: () => void;
}

/**
 * BatchApprovalBar - Floating bar for bulk accept/reject of suggestions
 *
 * Shows when there are 2+ pending suggestions, allowing users to
 * quickly approve or reject all changes at once.
 */
export function BatchApprovalBar({
  suggestions,
  onAcceptAll,
  onRejectAll,
}: BatchApprovalBarProps) {
  const count = suggestions.length;

  if (count < 2) {
    return null;
  }

  return (
    <div className="batch-approval-bar">
      <div className="batch-approval-count">
        <span className="count-badge">{count}</span>
        <span>pending {count === 1 ? 'suggestion' : 'suggestions'}</span>
      </div>

      <div className="batch-approval-actions">
        <button
          className="batch-btn batch-btn-accept-all"
          onClick={onAcceptAll}
          title="Accept all suggestions (⌘⇧⏎)"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Accept All
        </button>

        <button
          className="batch-btn batch-btn-reject-all"
          onClick={onRejectAll}
          title="Reject all suggestions (⌘⇧⌫)"
        >
          Reject All
        </button>
      </div>
    </div>
  );
}

export default BatchApprovalBar;
