/**
 * WidgetProvider - Sets up widget execution and UI
 *
 * Includes:
 * - Event listener for widget commands
 * - WidgetProgressTile (floating progress indicator)
 * - WidgetPreviewModal (preview and confirm)
 */

import { useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  useWidgetExecutionStore,
  useProjectStore,
  useWidgetStatus,
  useEditorSelection,
  useEditorSelectionDocumentId,
  useWidgetType,
} from '@mythos/state';
import { sendWidgetRunStreaming, type WidgetContextData } from '@mythos/ai/client';
import { useConvexAuth } from 'convex/react';
import { WidgetProgressTile } from './WidgetProgressTile';
import { WidgetPreviewModal } from './WidgetPreviewModal';

// Get base URL for API calls
function getBaseUrl(): string {
  return process.env.EXPO_PUBLIC_CONVEX_URL ?? '';
}

interface WidgetProviderProps {
  children: React.ReactNode;
}

interface ApplyInlineWidgetResult {
  requestId: string;
  executionId: string;
  applied: boolean;
  error?: string;
}

function applyInlineWidgetViaEvent(payload: {
  requestId: string;
  executionId: string;
  widgetId: string;
  projectId: string;
  content: string;
  range?: { from: number; to: number };
}): Promise<ApplyInlineWidgetResult> {
  return new Promise((resolve) => {
    const handleResult = (event: Event) => {
      const detail = (event as CustomEvent<ApplyInlineWidgetResult>).detail;
      if (!detail || detail.requestId !== payload.requestId) return;
      cleanup();
      resolve(detail);
    };

    const cleanup = () => {
      window.removeEventListener('widget:apply-inline-result', handleResult);
      window.clearTimeout(timeoutId);
    };

    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve({
        requestId: payload.requestId,
        executionId: payload.executionId,
        applied: false,
        error: 'Timed out applying widget output',
      });
    }, 2000);

    window.addEventListener('widget:apply-inline-result', handleResult);
    window.dispatchEvent(new CustomEvent('widget:apply-inline', { detail: payload }));
  });
}

export function WidgetProvider({ children }: WidgetProviderProps) {
  const start = useWidgetExecutionStore((s) => s.start);
  const reset = useWidgetExecutionStore((s) => s.reset);
  const getApplyData = useWidgetExecutionStore((s) => s.getApplyData);
  const markApplied = useWidgetExecutionStore((s) => s.markApplied);
  const setError = useWidgetExecutionStore((s) => s.setError);
  const projectId = useProjectStore((s) => s.currentProjectId);
  const currentDocumentId = useProjectStore((s) => s.currentDocumentId);
  const selection = useEditorSelection();
  const selectionDocumentId = useEditorSelectionDocumentId();
  const widgetType = useWidgetType();
  const status = useWidgetStatus();
  const { isAuthenticated } = useConvexAuth();

  // Create the stream executor that uses the shared client
  const createExecutor = useCallback(() => {
    return (
      payload: Parameters<typeof sendWidgetRunStreaming>[0],
      callbacks: {
        signal: AbortSignal;
        onContext: (data: WidgetContextData) => void;
        onDelta: (content: string) => void;
        onDone: () => void;
        onError: (error: Error) => void;
      }
    ) => {
      const baseUrl = getBaseUrl();

      void sendWidgetRunStreaming(payload, {
        baseUrl,
        signal: callbacks.signal,
        onContext: callbacks.onContext,
        onDelta: callbacks.onDelta,
        onDone: callbacks.onDone,
        onError: callbacks.onError,
      });
    };
  }, []);

  // Listen for widget command events from command palette
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!isAuthenticated) return;
    if (!projectId) return;

    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{
        widgetId: string;
        widgetType: 'inline' | 'artifact';
        widgetLabel: string;
        parameters?: Array<{ name: string; type: string; default?: string }>;
      }>;

      const { widgetId, widgetType, widgetLabel, parameters } = customEvent.detail;

      // Build default parameters
      const defaultParams = parameters?.reduce<Record<string, unknown>>((acc, param) => {
        if (param.default !== undefined) {
          acc[param.name] = param.default;
        }
        return acc;
      }, {});

      // Get selection from editor if available
      const selectionMatchesDoc = !selectionDocumentId || !currentDocumentId
        ? !!selection
        : selectionDocumentId === currentDocumentId;
      const selectionRange = selection && selectionMatchesDoc
        ? { from: selection.from, to: selection.to }
        : undefined;
      const selectionText = selectionMatchesDoc ? selection?.text : undefined;
      const targetDocumentId = selectionMatchesDoc
        ? selectionDocumentId ?? currentDocumentId ?? undefined
        : currentDocumentId ?? undefined;

      start(
        {
          widgetId,
          widgetType,
          widgetLabel,
          projectId,
          documentId: targetDocumentId,
          selectionText,
          selectionRange,
          parameters: defaultParams,
        },
        createExecutor()
      );
    };

    window.addEventListener('command:widget', handler);
    return () => window.removeEventListener('command:widget', handler);
  }, [
    isAuthenticated,
    projectId,
    currentDocumentId,
    selection,
    selectionDocumentId,
    start,
    createExecutor,
  ]); // Keep projectId in deps to re-register with latest value

  // Handle confirm action
  const handleConfirm = useCallback(async () => {
    const { previewContent, selection, currentWidgetId, projectId: pid, executionId } = getApplyData();

    if (!previewContent) return;
    if (!currentWidgetId || !pid || !executionId) {
      setError('Widget execution is not ready to apply.');
      return;
    }

    if (Platform.OS === 'web' && widgetType === 'inline') {
      const requestId = `apply-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const result = await applyInlineWidgetViaEvent({
        requestId,
        executionId,
        widgetId: currentWidgetId,
        projectId: pid,
        content: previewContent,
        range: selection ? { from: selection.from, to: selection.to } : undefined,
      });

      if (!result.applied) {
        setError(result.error ?? 'Failed to apply widget output.');
        return;
      }
    }

    markApplied();
    reset();
  }, [getApplyData, markApplied, reset, setError, widgetType]);

  return (
    <>
      {children}
      {/* Only render widget UI when we're in an active state */}
      {status !== 'idle' && (
        <>
          <WidgetProgressTile />
          <WidgetPreviewModal onConfirm={handleConfirm} />
        </>
      )}
    </>
  );
}
