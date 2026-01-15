/**
 * Editor Screen - TipTap editor (web only)
 *
 * This route renders the full TipTap editor on web platform.
 * On native platforms, shows a placeholder.
 */

import React, { Suspense, lazy, useCallback, useEffect, useRef } from 'react';
import { Platform, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAction } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useTheme, typography } from '@/design-system';
import { useAuthStore } from '@mythos/auth';
import {
  useLayoutStore,
  useCurrentProject,
  useDocuments,
  useProjectStore,
  useFlowEnabled,
  useFocusLevel,
  useDimOpacity,
  useTypewriterScrolling,
  useArtifactStore,
} from '@mythos/state';

// Custom event type for entity actions from editor
interface EntityOpenGraphEvent extends CustomEvent {
  detail: {
    entityId: string;
    entityName: string;
    entityType: string;
  };
}

// Lazy load editor only on web
const LazyEditorShell = Platform.OS === 'web'
  ? lazy(() => import('@mythos/editor-webview').then(mod => ({ default: mod.EditorShell })))
  : null;

export default function EditorScreen(): JSX.Element {
  const { colors } = useTheme();
  const { aiPanelMode, aiPanelWidth, sidebarCollapsed, openKnowledgePanel, pendingWriteContent, clearPendingWriteContent } =
    useLayoutStore();
  const { panelMode: artifactPanelMode, panelWidth: artifactPanelWidth, setPanelMode, openEntity } = useArtifactStore();

  // Listen for entity:open-graph events from editor
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleEntityOpenGraph = (event: Event) => {
      const { detail } = event as EntityOpenGraphEvent;
      console.log('[EditorScreen] Opening entity in Artifact Panel:', detail);

      // If AI panel is in side mode, use floating mode for artifact panel
      // Otherwise use side mode (artifact panel is hidden when AI panel is in side mode)
      const targetMode = aiPanelMode === 'side' ? 'floating' : 'side';
      setPanelMode(targetMode);

      // Open entity with basic data (will be enhanced to fetch full entity)
      openEntity(detail.entityId, detail.entityName, {
        id: detail.entityId,
        name: detail.entityName,
        type: detail.entityType,
      });
    };

    window.addEventListener('entity:open-graph', handleEntityOpenGraph);
    return () => {
      window.removeEventListener('entity:open-graph', handleEntityOpenGraph);
    };
  }, [setPanelMode, openEntity, aiPanelMode]);

  // Calculate scroll indicator right offset based on visible side panels
  // Note: Artifact panel is hidden when AI panel is in 'side' mode (see AppShell.tsx line 78)
  const showArtifactPanel = artifactPanelMode === 'side' && aiPanelMode !== 'side';
  const scrollIndicatorRightOffset =
    (aiPanelMode === 'side' ? aiPanelWidth : 0) +
    (showArtifactPanel ? artifactPanelWidth : 0);
  const params = useLocalSearchParams<{ projectId?: string | string[]; documentId?: string | string[] }>();
  const user = useAuthStore((s) => s.user);
  const sessionToken = useAuthStore((s) => s.session?.token ?? undefined);
  const project = useCurrentProject();
  const documents = useDocuments();
  const currentDocumentId = useProjectStore((s) => s.currentDocumentId);
  const setCurrentProjectId = useProjectStore((s) => s.setCurrentProjectId);
  const pendingApplied = useRef(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiAny: any = api;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resolveWriteContentFromEditor = useAction(apiAny.knowledgeSuggestions.resolveWriteContentFromEditor as any);

  const queryProjectId =
    typeof params.projectId === 'string' ? params.projectId : params.projectId?.[0];
  const queryDocumentId =
    typeof params.documentId === 'string' ? params.documentId : params.documentId?.[0];

  const activeDocumentId =
    queryDocumentId ?? currentDocumentId ?? documents[0]?.id ?? null;

  useEffect(() => {
    if (queryProjectId) {
      setCurrentProjectId(queryProjectId);
    }
  }, [queryProjectId, setCurrentProjectId]);

  const collaborationUser = user
    ? {
        id: user.id,
        name: user.name ?? user.email,
        avatarUrl: user.image ?? undefined,
      }
    : null;

  // Flow mode
  const flowEnabled = useFlowEnabled();
  const focusLevel = useFocusLevel();
  const dimOpacity = useDimOpacity();
  const typewriterScrolling = useTypewriterScrolling();

  const flowSettings = {
    enabled: flowEnabled,
    focusLevel,
    dimOpacity,
    typewriterScrolling,
  };

  // Hide quick actions when AI panel is visible (side or floating mode)
  const hideQuickActions = aiPanelMode === 'side' || aiPanelMode === 'floating';
  const collaborationProjectId = queryProjectId ?? project?.id ?? null;

  // Handle pending write_content application result
  const handleWriteContentApplied = useCallback(
    async (result: { applied: boolean; documentId?: string; snapshotJson?: string; summary?: string; error?: string }) => {
      if (pendingApplied.current) return;
      if (!pendingWriteContent) return;

      pendingApplied.current = true;

      if (result.applied && result.documentId && result.snapshotJson) {
        try {
          await resolveWriteContentFromEditor({
            toolCallId: pendingWriteContent.toolCallId,
            applied: true,
            documentId: result.documentId,
            snapshotJson: result.snapshotJson,
            reason: result.summary,
          });
        } catch (error) {
          console.warn('[EditorScreen] Failed to resolve write_content:', error);
        }
      }

      // Clear pending write content after handling
      clearPendingWriteContent();
      pendingApplied.current = false;
    },
    [clearPendingWriteContent, pendingWriteContent, resolveWriteContentFromEditor]
  );

  // Web-only: render TipTap editor
  if (Platform.OS === 'web' && LazyEditorShell) {
    return (
      <Suspense fallback={
        <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
          <ActivityIndicator color={colors.accent} />
        </View>
      }>
        <View style={styles.webContainer}>
          <div style={{
            height: '100%',
            width: '100%',
            flex: 1,
            // @ts-expect-error - web-only CSS properties
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }} className="editor-wrapper">
            <LazyEditorShell
              hideQuickActions={hideQuickActions}
              sidebarCollapsed={sidebarCollapsed}
              minimalMode={flowEnabled}
              flowSettings={flowSettings}
              scrollIndicatorRightOffset={scrollIndicatorRightOffset}
              collaboration={
                collaborationProjectId && activeDocumentId && collaborationUser
                  ? {
                      projectId: collaborationProjectId,
                      documentId: activeDocumentId,
                      user: collaborationUser,
                      authToken: sessionToken,
                    }
                  : undefined
              }
              pendingWriteContent={pendingWriteContent}
              onWriteContentApplied={handleWriteContentApplied}
              onVersionHistory={() => {
                openKnowledgePanel(collaborationProjectId);
              }}
              onQuickAction={(action: string) => {
                console.log('Quick action:', action);
              }}
              onShare={() => {
                console.log('Share clicked');
              }}
            />
          </div>
          {/* Hide all native scrollbars - editor uses custom scroll indicator */}
          <style dangerouslySetInnerHTML={{ __html: `
            .editor-wrapper,
            .editor-wrapper * {
              scrollbar-width: none !important;
              -ms-overflow-style: none !important;
            }
            .editor-wrapper::-webkit-scrollbar,
            .editor-wrapper *::-webkit-scrollbar,
            .editor-shell::-webkit-scrollbar,
            .editor-shell *::-webkit-scrollbar,
            .editor-container::-webkit-scrollbar {
              display: none !important;
              width: 0 !important;
              height: 0 !important;
              background: transparent !important;
            }
          ` }} />
        </View>
      </Suspense>
    );
  }

  // Native fallback
  return (
    <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
      <Text style={[styles.text, { color: colors.textMuted }]}>
        Editor is only available on web for now
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webContainer: {
    flex: 1,
  },
  text: {
    fontSize: typography.base,
  },
});
