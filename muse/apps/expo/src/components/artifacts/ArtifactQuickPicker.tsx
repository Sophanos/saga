/**
 * ArtifactQuickPicker - Quick access dropdown for artifacts
 *
 * Shows:
 * 1. Recent artifacts (last interacted)
 * 2. Other project artifacts
 *
 * Triggered from ⌘ button in artifact tab bar
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, radii, typography, shadows } from '@/design-system';
import {
  useArtifactStore,
  useArtifacts,
  ARTIFACT_TYPE_ICONS,
  type Artifact,
} from '@mythos/state';

const MAX_RECENT = 5;

interface ArtifactQuickPickerProps {
  visible: boolean;
  onClose: () => void;
}

export function ArtifactQuickPicker({ visible, onClose }: ArtifactQuickPickerProps) {
  const { colors } = useTheme();
  const artifacts = useArtifacts();
  const { setActiveArtifact, recentArtifactIds } = useArtifactStore();
  const [query, setQuery] = useState('');
  const inputRef = useRef<TextInput>(null);

  // Focus input when visible
  useEffect(() => {
    if (visible) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [visible]);

  // Filter and split into recent and others
  const { recent, others } = useMemo(() => {
    const recentIds = recentArtifactIds?.slice(0, MAX_RECENT) ?? [];
    const lowerQuery = query.toLowerCase().trim();

    const filterFn = (a: Artifact) =>
      !lowerQuery ||
      a.title.toLowerCase().includes(lowerQuery) ||
      a.type.toLowerCase().includes(lowerQuery);

    const recentArtifacts = recentIds
      .map((id) => artifacts.find((a) => a.id === id))
      .filter((a): a is Artifact => a !== undefined && filterFn(a));

    const otherArtifacts = artifacts.filter(
      (a) => !recentIds.includes(a.id) && filterFn(a)
    );

    return { recent: recentArtifacts, others: otherArtifacts };
  }, [artifacts, recentArtifactIds, query]);

  if (!visible) return null;

  const handleSelect = (id: string) => {
    setActiveArtifact(id);
    onClose();
  };

  const allFiltered = [...recent, ...others];

  return (
    <>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(100)}
        style={[
          styles.container,
          shadows.lg,
          { backgroundColor: colors.bgElevated, borderColor: colors.border },
        ]}
      >
        {/* Search input */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Feather name="search" size={14} color={colors.textMuted} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Quick switch artifact"
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
            returnKeyType="go"
            onSubmitEditing={() => {
              if (allFiltered.length > 0) {
                handleSelect(allFiltered[0].id);
              }
            }}
          />
          <Text style={[styles.shortcut, { color: colors.textMuted }]}>⌘K</Text>
        </View>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {/* Recent section */}
          {recent.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                Recent
              </Text>
              {recent.map((artifact) => (
                <ArtifactRow
                  key={artifact.id}
                  artifact={artifact}
                  onSelect={() => handleSelect(artifact.id)}
                />
              ))}
            </View>
          )}

          {/* Others section */}
          {others.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                {recent.length > 0 ? 'Others' : 'Artifacts'}
              </Text>
              {others.map((artifact) => (
                <ArtifactRow
                  key={artifact.id}
                  artifact={artifact}
                  onSelect={() => handleSelect(artifact.id)}
                />
              ))}
            </View>
          )}

          {/* Empty state */}
          {allFiltered.length === 0 && (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {query ? 'No matches' : 'No artifacts yet'}
              </Text>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </>
  );
}

interface ArtifactRowProps {
  artifact: Artifact;
  onSelect: () => void;
}

function ArtifactRow({ artifact, onSelect }: ArtifactRowProps) {
  const { colors } = useTheme();
  const iconName = ARTIFACT_TYPE_ICONS[artifact.type] as keyof typeof Feather.glyphMap;

  return (
    <Pressable
      onPress={onSelect}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.bgHover : 'transparent' },
      ]}
    >
      <Feather name={iconName} size={14} color={colors.textMuted} />
      <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
        {artifact.title}
      </Text>
      <Text style={[styles.rowType, { color: colors.textMuted }]}>
        {artifact.type}
      </Text>
    </Pressable>
  );
}

/**
 * Trigger button for quick picker
 */
interface QuickPickerTriggerProps {
  onPress: () => void;
}

export function QuickPickerTrigger({ onPress }: QuickPickerTriggerProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.trigger,
        { backgroundColor: pressed ? colors.bgHover : 'transparent' },
      ]}
      hitSlop={8}
    >
      <Feather name="search" size={14} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99,
  },
  container: {
    position: 'absolute',
    top: 40,
    right: 0,
    width: 280,
    maxHeight: 320,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sm,
    paddingVertical: 0,
    outlineStyle: 'none',
  } as any,
  shortcut: {
    fontSize: typography.xs,
    fontFamily: 'monospace',
  },
  list: {
    maxHeight: 260,
  },
  section: {
    paddingVertical: spacing[1],
  },
  sectionTitle: {
    fontSize: typography.xs,
    fontWeight: typography.medium as any,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  rowTitle: {
    flex: 1,
    fontSize: typography.sm,
  },
  rowType: {
    fontSize: typography.xs,
  },
  empty: {
    padding: spacing[6],
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.sm,
  },
  trigger: {
    width: 28,
    height: 28,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
