/**
 * Editor Screen - TipTap editor (web only)
 *
 * This route renders the full TipTap editor on web platform.
 * On native platforms, shows a placeholder.
 */

import React, { Suspense, lazy, useCallback, useEffect, useRef } from 'react';
import { Platform, View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAction } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useTheme, typography } from '@/design-system';
import { useAuthStore } from '@mythos/auth';
import {
  useLayoutStore,
  useCurrentProject,
  useDocuments,
  useProjectStore,
} from '@mythos/state';

// Lazy load editor only on web
const LazyEditorShell = Platform.OS === 'web'
  ? lazy(() => import('@mythos/editor-webview').then(mod => ({ default: mod.EditorShell })))
  : null;

export default function EditorScreen(): JSX.Element {
  const { colors } = useTheme();
  const router = useRouter();
  const { aiPanelMode, sidebarCollapsed, openKnowledgePanel, pendingWriteContent, clearPendingWriteContent } =
    useLayoutStore();
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
          <Pressable
            testID="editor-open-project-graph"
            onPress={() => router.push('/project-graph')}
            style={({ pressed, hovered }) => [
              styles.graphButton,
              {
                backgroundColor: pressed || hovered ? colors.accent + 'CC' : colors.accent,
              },
            ]}
          >
            <Text style={styles.graphButtonText}>Open Project Graph</Text>
          </Pressable>
          <div style={{
            height: '100%',
            width: '100%',
            flex: 1,
          }}>
            <LazyEditorShell
              hideQuickActions={hideQuickActions}
              sidebarCollapsed={sidebarCollapsed}
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
  graphButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    zIndex: 10,
  },
  graphButtonText: {
    color: '#fff',
    fontSize: typography.xs,
    fontWeight: '600',
  },
  text: {
    fontSize: typography.base,
  },
});
