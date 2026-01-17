/**
 * ArtifactPanel - Side panel for AI-generated artifacts with iteration chat
 *
 * Features:
 * - Shows artifact content (prose, diagram, table, code, etc.)
 * - Iteration mini-chat for refining artifacts
 * - Actions: Copy, Insert, Save
 * - Version history
 */

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  StyleSheet,
} from "react-native";
import { useAction, useMutation, useQuery } from "convex/react";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOutUp,
  Layout,
} from "react-native-reanimated";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTheme, spacing, typography, radii } from "@/design-system";
import { ArtifactChatPillContainer } from "./ArtifactChatPill";
import {
  useArtifactStore,
  useActiveArtifact,
  useArtifacts,
  ARTIFACT_TYPE_ICONS,
  ARTIFACT_TYPE_LABELS,
  useProjectStore,
  type Artifact,
  type ArtifactVersion,
  type ArtifactType,
  type ArtifactOp,
} from "@mythos/state";
import { parseArtifactEnvelope, type ArtifactEnvelopeByType } from "@mythos/core";
import { ArtifactRuntimeWebView } from "./ArtifactRuntimeWebView";
import { ArtifactTableNative } from "./runtime/ArtifactTableNative";
import { MermaidPreviewWebView } from "./MermaidPreviewWebView";
import { ArtifactTabBar } from "./ArtifactTabBar";
import { ArtifactQuickPicker, QuickPickerTrigger } from "./ArtifactQuickPicker";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

interface ArtifactPanelProps {
  flowMode?: boolean;
  focusId?: string | null;
}

// Helper to render artifact icon
function ArtifactIcon({ type, size = 16, color }: { type: ArtifactType; size?: number; color: string }) {
  const iconName = ARTIFACT_TYPE_ICONS[type] as keyof typeof Feather.glyphMap;
  return <Feather name={iconName} size={size} color={color} />;
}

export function ArtifactPanel({ flowMode = false, focusId }: ArtifactPanelProps) {
  const { colors } = useTheme();
  const artifact = useActiveArtifact();
  const artifacts = useArtifacts();
  const {
    removeArtifact,
    setActiveArtifact,
    splitView,
    enterSplitView,
    exitSplitView,
    setSplitView,
    applyArtifactOp,
  } = useArtifactStore();
  const projectId = useProjectStore((s) => s.currentProjectId);
  const iterateArtifact = useAction((api as any).ai.artifactIteration.iterateArtifact);
  const setStatusRemote = useMutation((api as any).artifacts.setStatus);
  const applyOpRemote = useMutation((api as any).artifacts.applyOp);

  /**
   * Apply artifact op with remote-then-local-fallback strategy
   * - If projectId exists: try server mutation first, fallback to local on error
   * - If no projectId: local apply only
   */
  const handleApplyOp = useCallback(
    async (op: ArtifactOp): Promise<void> => {
      if (!artifact) return;

      if (projectId) {
        try {
          const result = await applyOpRemote({
            projectId: projectId as Id<"projects">,
            artifactKey: artifact.id,
            op,
          });

          // Update local store with server result
          if (result?.nextEnvelope) {
            useArtifactStore.getState().updateArtifact(artifact.id, {
              content: JSON.stringify(result.nextEnvelope, null, 2),
            });
          }
        } catch (error) {
          console.warn("[ArtifactPanel] Remote op failed, applying locally", error);
          // Fallback to local apply
          applyArtifactOp(artifact.id, op);
        }
      } else {
        // No project - apply locally only
        applyArtifactOp(artifact.id, op);
      }
    },
    [artifact, projectId, applyOpRemote, applyArtifactOp]
  );

  const [showVersions, setShowVersions] = useState(false);
  const [showCompareList, setShowCompareList] = useState(false);
  const [showQuickPicker, setShowQuickPicker] = useState(false);
  const [isIterating, setIsIterating] = useState(false);
  const [historyOverflows, setHistoryOverflows] = useState(false);
  const [scrubIndex, setScrubIndex] = useState(0);
  const historyScrollRef = useRef<ScrollView>(null);

  const compareRight = splitView.active
    ? artifacts.find((a) => a.id === splitView.rightId) ?? null
    : null;

  const handleToggleCompare = (): void => {
    if (!artifact) return;
    if (artifacts.length < 2) return;

    if (!splitView.active) {
      const rightId = artifacts.find((a) => a.id !== artifact.id)?.id ?? null;
      if (!rightId) return;
      enterSplitView(artifact.id, rightId, "before-after");
      setShowCompareList(false);
      return;
    }

    exitSplitView();
    setShowCompareList(false);
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (artifact?.iterationHistory.length) {
      setTimeout(() => {
        historyScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [artifact?.iterationHistory.length]);

  useEffect(() => {
    if (!artifact) return;
    const currentIndex = artifact.versions.findIndex((v) => v.id === artifact.currentVersionId);
    if (currentIndex >= 0) {
      setScrubIndex(currentIndex);
    }
  }, [artifact?.currentVersionId, artifact?.versions]);

  useEffect(() => {
    if (!artifact) return;
    if (!splitView.active) return;

    const leftId = artifact.id;
    let rightId = splitView.rightId;

    if (!rightId || rightId === leftId) {
      rightId = artifacts.find((a) => a.id !== leftId)?.id ?? null;
    }

    if (!rightId) {
      exitSplitView();
      return;
    }

    if (splitView.leftId !== leftId || splitView.rightId !== rightId) {
      setSplitView({ leftId, rightId });
    }
  }, [
    artifact,
    artifacts,
    exitSplitView,
    setSplitView,
    splitView.active,
    splitView.leftId,
    splitView.rightId,
  ]);

  const serverArtifact = useQuery(
    (api as any).artifacts.getByKey,
    artifact && projectId
      ? { projectId: projectId as Id<"projects">, artifactKey: artifact.id }
      : "skip"
  ) as any;

  useEffect(() => {
    if (!artifact || !serverArtifact?.artifact) return;

    const versions = Array.isArray(serverArtifact.versions)
      ? [...serverArtifact.versions]
          .slice()
          .reverse()
          .map((version: any, index: number): ArtifactVersion => ({
            id: version._id,
            content: version.content,
            timestamp: version.createdAt,
            trigger: index === 0 ? "creation" : "manual",
          }))
      : artifact.versions;

    const messages = Array.isArray(serverArtifact.messages)
      ? serverArtifact.messages.map((message: any) => ({
          id: message._id,
          role: message.role,
          content: message.content,
          timestamp: message.createdAt,
          context: message.context,
        }))
      : artifact.iterationHistory;

    const latestVersionId = versions[versions.length - 1]?.id ?? artifact.currentVersionId;

    const nextFormat =
      serverArtifact.artifact.format === "json" ||
      serverArtifact.artifact.format === "plain" ||
      serverArtifact.artifact.format === "markdown"
        ? serverArtifact.artifact.format
        : artifact.format;

    useArtifactStore.getState().upsertArtifact({
      ...artifact,
      title: serverArtifact.artifact.title,
      content: serverArtifact.artifact.content,
      format: nextFormat as any,
      status: serverArtifact.artifact.status ?? artifact.status,
      createdAt: serverArtifact.artifact.createdAt,
      updatedAt: serverArtifact.artifact.updatedAt,
      createdBy: serverArtifact.artifact.createdBy,
      sources: serverArtifact.artifact.sources,
      executionContext: serverArtifact.artifact.executionContext,
      staleness: serverArtifact.staleness?.status,
      versions,
      currentVersionId: latestVersionId,
      iterationHistory: messages,
    });
  }, [artifact?.id, projectId, serverArtifact]);

  // Handle iteration submit from pill
  const handleIterationSubmit = async (message: string) => {
    if (!message || !artifact) return;
    if (isIterating) return;

    useArtifactStore.getState().addIterationMessage(artifact.id, {
      role: "user",
      content: message,
    });

    if (projectId) {
      setIsIterating(true);
      try {
        const result = await iterateArtifact({
          projectId: projectId as Id<"projects">,
          artifactKey: artifact.id,
          userMessage: message,
        });

        if (result?.assistantMessage) {
          useArtifactStore.getState().addIterationMessage(artifact.id, {
            role: "assistant",
            content: result.assistantMessage,
          });
        }

        if (result?.nextContent && typeof result.nextContent === "string") {
          useArtifactStore.getState().updateArtifact(artifact.id, {
            content: result.nextContent,
            format: result.nextFormat,
          });
        }
      } catch (error) {
        console.warn("[ArtifactPanel] Failed to iterate artifact", error);
        useArtifactStore.getState().addIterationMessage(artifact.id, {
          role: "assistant",
          content: "Failed to iterate artifact. Please try again.",
        });
      } finally {
        setIsIterating(false);
      }
    } else {
      useArtifactStore.getState().addIterationMessage(artifact.id, {
        role: "assistant",
        content: "Select a project to iterate this artifact.",
      });
    }
  };

  // Handle copy
  const handleCopy = async () => {
    if (!artifact) return;
    await Clipboard.setStringAsync(artifact.content);
  };

  // Handle insert (placeholder)
  const handleInsert = () => {
    if (!artifact) return;
    console.log("Insert artifact:", artifact.id);
  };

  // Handle save (placeholder)
  const handleSave = async (): Promise<void> => {
    if (!artifact) return;
    if (!projectId) return;

    try {
      await setStatusRemote({
        projectId: projectId as any,
        artifactKey: artifact.id,
        status: "saved",
      });
      useArtifactStore.getState().updateArtifact(artifact.id, { status: "saved" });
    } catch (error) {
      console.warn("[ArtifactPanel] Failed to save artifact", error);
    }
  };

  // Empty state
  if (!artifact) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
        <Animated.View
          entering={FadeIn.duration(200)}
          style={styles.emptyState}
        >
          <Feather name="layers" size={40} color={colors.textMuted} style={{ opacity: 0.5 }} />
          <Text style={[styles.emptyTitle, { color: colors.textMuted }]}>
            No artifact selected
          </Text>
          <Text style={[styles.emptyDescription, { color: colors.textMuted }]}>
            AI-generated content will appear here
          </Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      layout={Layout.springify().damping(20)}
      style={[styles.container, { backgroundColor: colors.bgApp }]}
    >
      {/* Header with tab bar */}
      <View style={styles.header}>
        {/* Left: Tab bar */}
        <View style={styles.headerLeft}>
          <ArtifactTabBar />
          {artifact.staleness && artifact.staleness !== "fresh" && (
            <Text style={[styles.versionBadge, { color: colors.textMuted }]}>
              {artifact.staleness}
            </Text>
          )}
          {artifact.versions.length > 1 && (
            <Pressable onPress={() => setShowVersions(!showVersions)}>
              <Text style={[styles.versionBadge, { color: colors.textMuted }]}>
                v{artifact.versions.length}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Right: Search + Copy + Close */}
        <View style={styles.headerRight}>
          {/* Quick picker */}
          <View style={styles.quickPickerContainer}>
            <QuickPickerTrigger onPress={() => setShowQuickPicker(true)} />
            <ArtifactQuickPicker
              visible={showQuickPicker}
              onClose={() => setShowQuickPicker(false)}
            />
          </View>

          <Pressable
            onPress={handleCopy}
            style={({ pressed }) => [
              styles.copyBtn,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="copy" size={14} color={colors.textMuted} />
            <Text style={[styles.copyText, { color: colors.textMuted }]}>Copy</Text>
          </Pressable>
          {projectId && (
            <Pressable
              onPress={artifact.status === "saved" ? undefined : handleSave}
              style={({ pressed }) => [
                styles.copyBtn,
                { opacity: artifact.status === "saved" ? 0.4 : pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="bookmark" size={14} color={colors.textMuted} />
              <Text style={[styles.copyText, { color: colors.textMuted }]}>
                {artifact.status === "saved" ? "Saved" : "Save"}
              </Text>
            </Pressable>
          )}
          {artifacts.length > 1 && (
            <Pressable
              onPress={handleToggleCompare}
              style={({ pressed }) => [
                styles.copyBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="columns" size={14} color={colors.textMuted} />
              <Text style={[styles.copyText, { color: colors.textMuted }]}>
                {splitView.active ? "Done" : "Compare"}
              </Text>
            </Pressable>
          )}
          {splitView.active && compareRight && (
            <Pressable
              onPress={() => setShowCompareList(!showCompareList)}
              style={({ pressed }) => [
                styles.copyBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text
                style={[styles.copyText, { color: colors.textMuted, maxWidth: 110 }]}
                numberOfLines={1}
              >
                {compareRight.title}
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => removeArtifact(artifact.id)}
            style={styles.closeBtn}
          >
            <Feather name="x" size={16} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Compare list dropdown */}
        {splitView.active && showCompareList && (
          <Animated.View
            entering={FadeInDown.duration(150)}
            exiting={FadeOutUp.duration(100)}
            style={[styles.artifactList, { backgroundColor: colors.bgElevated }]}
          >
            {artifacts
              .filter((a) => a.id !== artifact.id)
              .map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => {
                    setSplitView({ rightId: a.id });
                    setShowCompareList(false);
                  }}
                  style={[
                    styles.artifactListItem,
                    a.id === splitView.rightId && { backgroundColor: colors.accent + "33" },
                  ]}
                >
                  <ArtifactIcon type={a.type} size={14} color={a.id === splitView.rightId ? colors.accent : colors.textMuted} />
                  <Text
                    style={[
                      styles.artifactListItemText,
                      { color: a.id === splitView.rightId ? colors.accent : colors.text },
                    ]}
                    numberOfLines={1}
                  >
                    {a.title}
                  </Text>
                </Pressable>
              ))}
          </Animated.View>
        )}

        {/* Version history */}
        {showVersions && (
          <Animated.View
            entering={FadeInDown.duration(150)}
            exiting={FadeOutUp.duration(100)}
            style={[styles.versionList, { backgroundColor: colors.bgElevated }]}
          >
            {artifact.versions.length > 1 && (
              <View style={styles.versionScrub}>
                <Pressable
                  onPress={() => {
                    const nextIndex = Math.max(0, scrubIndex - 1);
                    const target = artifact.versions[nextIndex];
                    if (target) {
                      useArtifactStore.getState().restoreVersion(artifact.id, target.id);
                      setScrubIndex(nextIndex);
                    }
                  }}
                  style={styles.versionScrubButton}
                >
                  <Text style={[styles.versionScrubText, { color: colors.textMuted }]}>{"<"}</Text>
                </Pressable>
                <Text style={[styles.versionScrubText, { color: colors.textMuted }]}>
                  v{scrubIndex + 1} / {artifact.versions.length}
                </Text>
                <Pressable
                  onPress={() => {
                    const nextIndex = Math.min(artifact.versions.length - 1, scrubIndex + 1);
                    const target = artifact.versions[nextIndex];
                    if (target) {
                      useArtifactStore.getState().restoreVersion(artifact.id, target.id);
                      setScrubIndex(nextIndex);
                    }
                  }}
                  style={styles.versionScrubButton}
                >
                  <Text style={[styles.versionScrubText, { color: colors.textMuted }]}>{">"}</Text>
                </Pressable>
              </View>
            )}
            {[...artifact.versions].reverse().map((v, idx) => (
              <Pressable
                key={v.id}
                onPress={() => {
                  useArtifactStore.getState().restoreVersion(artifact.id, v.id);
                  setShowVersions(false);
                }}
                style={[
                  styles.versionItem,
                  v.id === artifact.currentVersionId && { backgroundColor: colors.accent + "33" },
                ]}
              >
                <Text
                  style={[
                    styles.versionText,
                    { color: v.id === artifact.currentVersionId ? colors.accent : colors.textMuted },
                  ]}
                >
                  Version {artifact.versions.length - idx}
                </Text>
                <Text style={[styles.versionTime, { color: colors.textMuted }]}>
                  {new Date(v.timestamp).toLocaleTimeString()}
                </Text>
              </Pressable>
            ))}
          </Animated.View>
        )}
      </View>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {splitView.active && compareRight ? (
          <View>
            <Text style={[styles.compareLabel, { color: colors.textMuted }]}>Before</Text>
            <ArtifactRenderer artifact={artifact} colors={colors} onApplyOp={handleApplyOp} focusId={focusId} />
            <View style={[styles.compareDivider, { borderBottomColor: colors.border }]} />
            <Text style={[styles.compareLabel, { color: colors.textMuted }]}>After</Text>
            <ArtifactRenderer artifact={compareRight} colors={colors} onApplyOp={handleApplyOp} />
          </View>
        ) : (
          <ArtifactRenderer artifact={artifact} colors={colors} onApplyOp={handleApplyOp} focusId={focusId} />
        )}
      </ScrollView>

      {/* Iteration Chat - hidden in flow mode */}
      {!flowMode && (
        <View style={styles.iterationSection}>
          <ArtifactChatPillContainer
            onSubmit={handleIterationSubmit}
            placeholder="Refine artifact..."
            disabled={isIterating}
          >
            {/* Iteration history - oldest at top with fade, newest at bottom */}
            {artifact.iterationHistory.length > 0 && (
              <View style={styles.iterationHistoryContainer}>
                <ScrollView
                  ref={historyScrollRef}
                  style={styles.iterationHistory}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.iterationHistoryContent}
                  onContentSizeChange={(_, contentHeight) => {
                    setHistoryOverflows(contentHeight > 120);
                  }}
                >
                  {artifact.iterationHistory.map((msg) => (
                    <View
                      key={msg.id}
                      style={[
                        styles.iterationMessage,
                        {
                          backgroundColor:
                            msg.role === "user" ? colors.bgElevated : colors.accent + "1A",
                          marginLeft: msg.role === "user" ? spacing[4] : 0,
                        },
                      ]}
                    >
                      <Text style={[styles.iterationMessageText, { color: colors.text }]}>
                        {msg.content}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
                {/* Fade gradient at top - only when overflowing */}
                {historyOverflows && (
                  <LinearGradient
                    colors={[colors.bgApp, 'transparent']}
                    style={styles.fadeOverlay}
                    pointerEvents="none"
                  />
                )}
              </View>
            )}
          </ArtifactChatPillContainer>
        </View>
      )}

      {/* Minimal actions in flow mode */}
      {flowMode && (
        <View style={[styles.flowModeActions, { borderTopColor: colors.border }]}>
          <Pressable
            onPress={handleCopy}
            style={[styles.actionButton, { borderColor: colors.border }]}
          >
            <Text style={[styles.actionButtonText, { color: colors.text }]}>Copy</Text>
          </Pressable>
          <Pressable
            onPress={handleInsert}
            style={[styles.actionButton, { borderColor: colors.border }]}
          >
            <Text style={[styles.actionButtonText, { color: colors.text }]}>Insert</Text>
          </Pressable>
          {projectId && (
            <Pressable
              onPress={artifact.status === "saved" ? undefined : handleSave}
              style={[
                styles.actionButton,
                { borderColor: colors.border, opacity: artifact.status === "saved" ? 0.4 : 1 },
              ]}
            >
              <Text style={[styles.actionButtonText, { color: colors.text }]}>
                {artifact.status === "saved" ? "Saved" : "Save"}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </Animated.View>
  );
}

// Artifact content renderer
function ArtifactRenderer({
  artifact,
  colors,
  onApplyOp,
  focusId,
}: {
  artifact: Artifact;
  colors: ReturnType<typeof useTheme>["colors"];
  onApplyOp?: (op: ArtifactOp) => void;
  focusId?: string | null;
}) {
  const runtimeEnvelope = useMemo(() => {
    if (artifact.format !== "json") return null;
    try {
      return parseArtifactEnvelope(JSON.parse(artifact.content));
    } catch {
      return null;
    }
  }, [artifact.content, artifact.format]);

  const runtimeText = useMemo(() => {
    if (!runtimeEnvelope) return null;

    if (
      runtimeEnvelope.type === "prose" ||
      runtimeEnvelope.type === "dialogue" ||
      runtimeEnvelope.type === "lore" ||
      runtimeEnvelope.type === "code" ||
      runtimeEnvelope.type === "map"
    ) {
      const data = (runtimeEnvelope as Extract<
        ArtifactEnvelopeByType,
        { type: "prose" | "dialogue" | "lore" | "code" | "map" }
      >).data;

      const blocks = data.blockOrder
        .map((blockId) => data.blocksById[blockId])
        .filter(Boolean);

      return blocks.map((block) => block.markdown).join("\n\n");
    }

    return null;
  }, [runtimeEnvelope]);

  // Route RAS table envelopes to native renderer for gesture-based reordering
  if (runtimeEnvelope?.type === "table" && onApplyOp) {
    return (
      <ArtifactTableNative
        envelope={runtimeEnvelope as Extract<ArtifactEnvelopeByType, { type: "table" }>}
        focusId={focusId}
        onApplyOp={onApplyOp}
      />
    );
  }

  // Use WebView runtime for diagram, timeline, chart
  const useWebViewRuntime =
    runtimeEnvelope &&
    (runtimeEnvelope.type === "diagram" ||
      runtimeEnvelope.type === "timeline" ||
      runtimeEnvelope.type === "chart");

  if (useWebViewRuntime) {
    return <ArtifactRuntimeWebView artifact={artifact} focusId={focusId} />;
  }

  if (runtimeText != null) {
    if (runtimeEnvelope?.type === "code") {
      return <CodeRenderer content={runtimeText} colors={colors} />;
    }

    return <ProseRenderer content={runtimeText} colors={colors} />;
  }

  switch (artifact.type) {
    case "diagram":
      return <MermaidPreviewWebView content={artifact.content} />;
    case "table":
      return <TableRenderer content={artifact.content} format={artifact.format} colors={colors} />;
    case "timeline":
      return <TimelineRenderer content={artifact.content} colors={colors} />;
    case "entity":
      return <EntityRenderer content={artifact.content} title={artifact.title} colors={colors} />;
    case "code":
      return <CodeRenderer content={artifact.content} colors={colors} />;
    default:
      return <ProseRenderer content={artifact.content} colors={colors} />;
  }
}

// Prose renderer
function ProseRenderer({
  content,
  colors,
}: {
  content: string;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <Text style={[styles.prose, { color: colors.text }]}>{content}</Text>
  );
}

// Table renderer
function TableRenderer({
  content,
  format,
  colors,
}: {
  content: string;
  format: string;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  const tableData = useMemo(() => {
    if (format === "json") {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.rows)) return parsed.rows;
        return null;
      } catch {
        return null;
      }
    }
    const lines = content.trim().split("\n").filter((l) => l.trim() && !l.includes("---"));
    if (lines.length === 0) return null;
    return lines.map((line) =>
      line.split("|").map((cell) => cell.trim()).filter(Boolean)
    );
  }, [content, format]);

  const activeArtifact = useActiveArtifact();
  const addIterationMessage = useArtifactStore((s) => s.addIterationMessage);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [editedCells, setEditedCells] = useState<Record<string, string>>({});
  const [editingCell, setEditingCell] = useState<{ rowId: string; colIndex: number } | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const tableRows = Array.isArray(tableData) ? tableData : [];
  const header = tableRows[0] ?? [];
  const rows = tableRows.slice(1);
  const rowIds = rows.map((_, index) => `row-${index}`);
  const allSelected = rows.length > 0 && selectedRowIds.length === rows.length;

  useEffect(() => {
    setSelectedRowIds([]);
    setEditedCells({});
    setEditingCell(null);
    setEditingValue("");
  }, [content, format]);

  const toggleRow = (rowId: string) => {
    setSelectedRowIds((current) =>
      current.includes(rowId)
        ? current.filter((id) => id !== rowId)
        : [...current, rowId]
    );
  };

  const toggleAll = () => {
    setSelectedRowIds(allSelected ? [] : rowIds);
  };

  const handleAddRow = () => {
    if (!activeArtifact) return;
    addIterationMessage(activeArtifact.id, {
      role: "user",
      content: "Add a row to the table.",
    });
  };

  const startEdit = (rowId: string, colIndex: number, value: string) => {
    setEditingCell({ rowId, colIndex });
    setEditingValue(value);
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const rowIndex = rowIds.indexOf(editingCell.rowId);
    const rowLabel = rowIndex >= 0 ? String(rowIndex + 1) : editingCell.rowId;
    const headerValue = header[editingCell.colIndex];
    let columnLabel = `Column ${editingCell.colIndex + 1}`;
    if (typeof headerValue === "string" && headerValue.trim().length > 0) {
      columnLabel = headerValue;
    } else if (headerValue !== undefined && headerValue !== null) {
      columnLabel = String(headerValue);
    }

    setEditedCells((current) => ({
      ...current,
      [`${editingCell.rowId}:${editingCell.colIndex}`]: editingValue,
    }));
    setEditingCell(null);
    setEditingValue("");

    if (!activeArtifact) return;
    addIterationMessage(activeArtifact.id, {
      role: "user",
      content: `Update table row ${rowLabel} column \"${columnLabel}\" to \"${editingValue}\".`,
    });
  };

  if (!tableData || !Array.isArray(tableData) || tableData.length === 0) {
    return <ProseRenderer content={content} colors={colors} />;
  }

  return (
    <View>
      {/* Header */}
      <View style={[styles.tableRow, styles.tableHeader, { borderBottomColor: colors.border }]}>
        <View style={styles.tableHandleCell}>
          <Feather name="more-vertical" size={12} color={colors.textMuted} />
        </View>
        <Pressable onPress={toggleAll} style={styles.tableCheckboxCell}>
          <Feather
            name={allSelected ? "check-square" : "square"}
            size={14}
            color={allSelected ? colors.accent : colors.textMuted}
          />
        </Pressable>
        {header.map((cell: string, i: number) => (
          <Text key={i} style={[styles.tableHeaderCell, { color: colors.textMuted }]}>
            {cell}
          </Text>
        ))}
      </View>
      {/* Rows */}
      {rows.map((row: string[], i: number) => (
        <View key={i} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
          <View style={styles.tableHandleCell}>
            <Feather name="more-vertical" size={12} color={colors.textMuted} />
          </View>
          <Pressable onPress={() => toggleRow(rowIds[i])} style={styles.tableCheckboxCell}>
            <Feather
              name={selectedRowIds.includes(rowIds[i]) ? "check-square" : "square"}
              size={14}
              color={selectedRowIds.includes(rowIds[i]) ? colors.accent : colors.textMuted}
            />
          </Pressable>
          {row.map((cell: string, j: number) => {
            const cellKey = `${rowIds[i]}:${j}`;
            const editedValue = editedCells[cellKey];
            const displayValue = editedValue ?? String(cell ?? "");
            const isEditing =
              editingCell?.rowId === rowIds[i] && editingCell?.colIndex === j;

            if (isEditing) {
              return (
                <TextInput
                  key={j}
                  value={editingValue}
                  onChangeText={setEditingValue}
                  onEndEditing={commitEdit}
                  autoFocus
                  style={[
                    styles.tableCellInput,
                    { color: colors.text, borderColor: colors.border },
                  ]}
                  returnKeyType="done"
                  accessibilityLabel={`Edit row ${i + 1} column ${j + 1}`}
                />
              );
            }

            return (
              <Pressable
                key={j}
                onPress={() => startEdit(rowIds[i], j, displayValue)}
                style={styles.tableCellPressable}
              >
                <Text style={[styles.tableCellText, { color: colors.text }]}>
                  {displayValue}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
      <Pressable onPress={handleAddRow} style={styles.addRowButton}>
        <Text style={[styles.addRowText, { color: colors.textMuted }]}>+ Add row</Text>
      </Pressable>
    </View>
  );
}

// Timeline renderer
function TimelineRenderer({
  content,
  colors,
}: {
  content: string;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  const events = useMemo(() => {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      const lines = content.split("\n").filter((l) => l.trim());
      return lines.map((line) => {
        const match = line.match(/^(\d+)\s*[-–—:]\s*(.+)$/);
        if (match) return { year: parseInt(match[1]), event: match[2] };
        return { year: 0, event: line };
      });
    }
    return [];
  }, [content]);

  if (events.length === 0) {
    return <ProseRenderer content={content} colors={colors} />;
  }

  return (
    <View>
      {events.map((e: { year: number; event: string }, i: number) => (
        <View key={i} style={styles.timelineItem}>
          <Text style={[styles.timelineYear, { color: colors.accent }]}>{e.year}</Text>
          <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.timelineEvent, { color: colors.text }]}>{e.event}</Text>
        </View>
      ))}
    </View>
  );
}

// Entity renderer
function EntityRenderer({
  content,
  title,
  colors,
}: {
  content: string;
  title: string;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  const data = useMemo(() => {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }, [content]);

  if (!data) {
    return <ProseRenderer content={content} colors={colors} />;
  }

  return (
    <View>
      <View style={styles.entityHeader}>
        <View style={[styles.entityAvatar, { backgroundColor: colors.accent + "33" }]}>
          <Feather name="user" size={24} color={colors.accent} />
        </View>
        <View>
          <Text style={[styles.entityName, { color: colors.text }]}>{title}</Text>
          {data.role && (
            <Text style={[styles.entityRole, { color: colors.textMuted }]}>{data.role}</Text>
          )}
        </View>
      </View>
      {data.description && (
        <Text style={[styles.entityDescription, { color: colors.textMuted }]}>
          {data.description}
        </Text>
      )}
      <View style={styles.entityFields}>
        {Object.entries(data)
          .filter(([k]) => !["description", "role", "name"].includes(k))
          .map(([key, value]) => (
            <View key={key} style={[styles.entityField, { backgroundColor: colors.bgElevated }]}>
              <Text style={[styles.entityFieldLabel, { color: colors.textMuted }]}>
                {key}
              </Text>
              <Text style={[styles.entityFieldValue, { color: colors.text }]}>
                {Array.isArray(value) ? value.join(", ") : String(value)}
              </Text>
            </View>
          ))}
      </View>
    </View>
  );
}

// Code renderer
function CodeRenderer({
  content,
  colors,
}: {
  content: string;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <View style={[styles.codeContainer, { backgroundColor: colors.bgElevated }]}>
      <Text style={[styles.codeText, { color: colors.text }]}>{content}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing[6],
  },
  emptyIcon: {
    marginBottom: spacing[3],
  },
  emptyTitle: {
    fontSize: typography.sm,
    marginBottom: spacing[1],
  },
  emptyDescription: {
    fontSize: typography.xs,
    opacity: 0.7,
  },
  // Minimal header - Claude style
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    zIndex: 10,
  },
  headerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    overflow: "hidden",
  },
  typeLabel: {
    fontSize: typography.xs,
  },
  versionBadge: {
    fontSize: typography.xs,
    opacity: 0.7,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    flexShrink: 0,
  },
  quickPickerContainer: {
    position: "relative",
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1],
  },
  copyText: {
    fontSize: typography.xs,
  },
  closeBtn: {
    padding: spacing[1],
  },
  artifactList: {
    position: "absolute",
    top: "100%",
    left: spacing[2],
    right: spacing[2],
    borderRadius: radii.md,
    padding: spacing[1],
    zIndex: 100,
  },
  artifactListItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1.5],
    borderRadius: radii.sm,
  },
  artifactListItemText: {
    fontSize: typography.xs,
    flex: 1,
  },
  // Keep these for version dropdown (legacy)
  titleText: {
    flex: 1,
  },
  title: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  subtitle: {
    fontSize: typography.xs,
  },
  headerActions: {
    flexDirection: "row",
    gap: spacing[1],
  },
  headerButton: {
    padding: spacing[1.5],
    borderRadius: radii.md,
  },
  versionList: {
    borderRadius: radii.md,
    padding: spacing[2],
    marginTop: spacing[2],
  },
  versionScrub: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[2],
    paddingBottom: spacing[2],
  },
  versionScrubButton: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  versionScrubText: {
    fontSize: typography.xs,
  },
  versionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radii.sm,
  },
  versionText: {
    fontSize: typography.xs,
  },
  versionTime: {
    fontSize: typography.xs,
  },
  content: {
    flex: 1,
    zIndex: 1,
  },
  contentInner: {
    padding: spacing[4],
  },
  compareLabel: {
    fontSize: typography.xs,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing[2],
  },
  compareDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginVertical: spacing[4],
  },
  iterationSection: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
  },
  iterationHistoryContainer: {
    position: "relative",
    maxHeight: 120,
    marginBottom: spacing[4],
  },
  iterationHistory: {
    flex: 1,
  },
  iterationHistoryContent: {
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  fadeOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 20,
  },
  iterationMessage: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radii.md,
    marginBottom: spacing[1],
  },
  iterationMessageText: {
    fontSize: 11,
  },
  flowModeActions: {
    flexDirection: "row",
    gap: spacing[2],
    padding: spacing[3],
    borderTopWidth: 1,
  },
  actionButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing[2],
    alignItems: "center",
  },
  actionButtonText: {
    fontSize: typography.xs,
  },
  // Prose
  prose: {
    fontSize: typography.sm,
    lineHeight: typography.sm * typography.relaxed,
  },
  // Table
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tableHeader: {
    borderBottomWidth: 1,
  },
  tableHandleCell: {
    width: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  tableCheckboxCell: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  tableHeaderCell: {
    flex: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    fontSize: typography.xs,
    fontWeight: typography.medium,
    textTransform: "uppercase",
  },
  tableCellPressable: {
    flex: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  tableCellText: {
    fontSize: typography.sm,
  },
  tableCellInput: {
    flex: 1,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    fontSize: typography.sm,
    borderWidth: 1,
    borderRadius: radii.sm,
  },
  addRowButton: {
    paddingVertical: spacing[2],
    marginTop: spacing[1],
  },
  addRowText: {
    fontSize: typography.xs,
  },
  // Timeline
  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing[3],
  },
  timelineYear: {
    width: 48,
    textAlign: "right",
    fontSize: typography.xs,
    fontFamily: typography.fontMono,
  },
  timelineLine: {
    width: 1,
    alignSelf: "stretch",
    marginHorizontal: spacing[3],
  },
  timelineEvent: {
    flex: 1,
    fontSize: typography.sm,
  },
  // Entity
  entityHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing[4],
  },
  entityAvatar: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing[3],
  },
  entityName: {
    fontSize: typography.base,
    fontWeight: typography.medium,
  },
  entityRole: {
    fontSize: typography.xs,
  },
  entityDescription: {
    fontSize: typography.sm,
    marginBottom: spacing[4],
  },
  entityFields: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  entityField: {
    borderRadius: radii.md,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1.5],
    minWidth: "45%",
  },
  entityFieldLabel: {
    fontSize: typography.xs,
    textTransform: "capitalize",
  },
  entityFieldValue: {
    fontSize: typography.xs,
  },
  // Code
  codeContainer: {
    borderRadius: radii.lg,
    padding: spacing[4],
  },
  codeText: {
    fontSize: typography.xs,
    fontFamily: typography.fontMono,
  },
});
