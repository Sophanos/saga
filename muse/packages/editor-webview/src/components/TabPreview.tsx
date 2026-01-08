import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface TabPreviewProps {
  title: string;
  content?: string;
  isVisible: boolean;
  anchorRect: DOMRect | null;
}

interface Position {
  x: number;
  y: number;
  placement: 'bottom' | 'top';
}

const PREVIEW_WIDTH = 340;
const PREVIEW_HEIGHT_ESTIMATE = 240;
const VIEWPORT_PADDING = 12;
const OFFSET = 8;

function computePosition(anchorRect: DOMRect): Position {
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  };

  // Default: position below, centered
  let x = anchorRect.left + anchorRect.width / 2;
  let y = anchorRect.bottom + OFFSET;
  let placement: 'bottom' | 'top' = 'bottom';

  // Flip: if not enough space below, position above
  const spaceBelow = viewport.height - anchorRect.bottom - VIEWPORT_PADDING;
  const spaceAbove = anchorRect.top - VIEWPORT_PADDING;

  if (spaceBelow < PREVIEW_HEIGHT_ESTIMATE && spaceAbove > spaceBelow) {
    y = anchorRect.top - OFFSET;
    placement = 'top';
  }

  // Shift: keep within horizontal bounds
  const halfWidth = PREVIEW_WIDTH / 2;
  const minX = halfWidth + VIEWPORT_PADDING;
  const maxX = viewport.width - halfWidth - VIEWPORT_PADDING;
  x = Math.max(minX, Math.min(maxX, x));

  return { x, y, placement };
}

export function TabPreview({ title, content, isVisible, anchorRect }: TabPreviewProps) {
  if (!isVisible || !anchorRect) return null;

  const { x, y, placement } = computePosition(anchorRect);
  const displayTitle = title || 'Untitled';

  const transformOrigin = placement === 'bottom' ? 'top center' : 'bottom center';
  const translateY = placement === 'bottom' ? '-4px' : '4px';

  return createPortal(
    <div
      className={`tab-preview tab-preview--${placement}`}
      style={{
        left: x,
        top: placement === 'bottom' ? y : 'auto',
        bottom: placement === 'top' ? `calc(100vh - ${y}px)` : 'auto',
        '--transform-origin': transformOrigin,
        '--translate-y': translateY,
      } as React.CSSProperties}
    >
      <div className="tab-preview-header">
        <PageIcon />
        <span className="tab-preview-title">{displayTitle}</span>
      </div>
      <div className="tab-preview-body">
        <p className="tab-preview-content">{content || '\u00A0'}</p>
        <div className="tab-preview-fade" />
      </div>

      <style>{`
        .tab-preview {
          position: fixed;
          transform: translateX(-50%);
          width: ${PREVIEW_WIDTH}px;
          max-width: calc(100vw - ${VIEWPORT_PADDING * 2}px);
          background: #282828;
          border-radius: 10px;
          padding: 14px 16px 14px 14px;
          z-index: 10000;
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.06),
            0 4px 12px rgba(0, 0, 0, 0.32),
            0 16px 40px rgba(0, 0, 0, 0.4);
          animation: tabPreviewIn 180ms cubic-bezier(0.32, 0.72, 0, 1);
          transform-origin: var(--transform-origin);
          pointer-events: none;
        }

        @keyframes tabPreviewIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(var(--translate-y)) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
        }

        .tab-preview-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .tab-preview-header svg {
          width: 22px;
          height: 22px;
          color: rgba(255, 255, 255, 0.45);
          flex-shrink: 0;
          margin-top: 0;
        }

        .tab-preview-title {
          flex: 1;
          font-size: 15px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
          line-height: 1.4;
          word-break: break-word;
        }

        .tab-preview-body {
          position: relative;
          margin-top: 8px;
          padding-left: 34px;
          height: 100px;
          overflow: hidden;
        }

        .tab-preview-content {
          font-size: 13px;
          line-height: 1.55;
          color: rgba(255, 255, 255, 0.45);
          margin: 0;
          word-break: break-word;
        }

        .tab-preview-fade {
          position: absolute;
          bottom: 0;
          left: 34px;
          right: 0;
          height: 32px;
          background: linear-gradient(to bottom, transparent, #282828);
          pointer-events: none;
        }
      `}</style>
    </div>,
    document.body
  );
}

export function useTabPreview(delay = 500) {
  const [isVisible, setIsVisible] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [previewData, setPreviewData] = useState<{ title: string; content?: string } | null>(null);

  const showTimeoutRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);
  const currentTabRef = useRef<string | null>(null);

  const showPreview = useCallback((
    tabId: string,
    title: string,
    content: string | undefined,
    element: HTMLElement
  ) => {
    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    if (showTimeoutRef.current && currentTabRef.current !== tabId) {
      window.clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }

    currentTabRef.current = tabId;

    // If already visible for this tab, just update position
    if (isVisible && currentTabRef.current === tabId) {
      setAnchorRect(element.getBoundingClientRect());
      return;
    }

    showTimeoutRef.current = window.setTimeout(() => {
      if (currentTabRef.current === tabId) {
        setAnchorRect(element.getBoundingClientRect());
        setPreviewData({ title, content });
        setIsVisible(true);
      }
    }, delay);
  }, [delay, isVisible]);

  const hidePreview = useCallback(() => {
    if (showTimeoutRef.current) {
      window.clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }

    currentTabRef.current = null;

    hideTimeoutRef.current = window.setTimeout(() => {
      setIsVisible(false);
      setPreviewData(null);
    }, 100);
  }, []);

  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) window.clearTimeout(showTimeoutRef.current);
      if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  return {
    isVisible,
    anchorRect,
    previewData,
    showPreview,
    hidePreview,
  };
}

function PageIcon() {
  return (
    <svg viewBox="0 0 22 22" fill="none">
      <path
        d="M5 4C5 2.89543 5.89543 2 7 2H12.5858C13.1162 2 13.6249 2.21071 14 2.58579L17.4142 6C17.7893 6.37507 18 6.88378 18 7.41421V18C18 19.1046 17.1046 20 16 20H7C5.89543 20 5 19.1046 5 18V4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 2.5V6C13 6.55228 13.4477 7 14 7H17.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
