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
import { useWidgetExecutionStore, useProjectStore, useWidgetStatus } from '@mythos/state';
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

export function WidgetProvider({ children }: WidgetProviderProps) {
  const start = useWidgetExecutionStore((s) => s.start);
  const reset = useWidgetExecutionStore((s) => s.reset);
  const getApplyData = useWidgetExecutionStore((s) => s.getApplyData);
  const projectId = useProjectStore((s) => s.currentProjectId);
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
      // TODO: Wire up selection from editor state
      const selectionText = undefined;
      const selectionRange = undefined;

      start(
        {
          widgetId,
          widgetType,
          widgetLabel,
          projectId,
          selectionText,
          selectionRange,
          parameters: defaultParams,
        },
        createExecutor()
      );
    };

    window.addEventListener('command:widget', handler);
    return () => window.removeEventListener('command:widget', handler);
  }, [isAuthenticated, projectId, start, createExecutor]); // Keep projectId in deps to re-register with latest value

  // Handle confirm action
  const handleConfirm = useCallback(() => {
    const { previewContent, selection, currentWidgetId, projectId: pid, executionId } = getApplyData();

    if (!previewContent) return;

    // TODO: For inline widgets, apply to editor
    // TODO: For artifact widgets, create artifact via Convex

    // For now, just log and reset
    console.log('[WidgetProvider] Confirmed widget execution:', {
      widgetId: currentWidgetId,
      projectId: pid,
      executionId,
      contentLength: previewContent.length,
    });

    reset();
  }, [getApplyData, reset]);

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
