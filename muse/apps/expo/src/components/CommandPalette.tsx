/**
 * CommandPalette - ⌘K command palette
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Modal,
  StyleSheet,
  Platform,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, radii, typography } from '@/design-system';
import {
  useCommandPaletteStore,
  useCommandPaletteOpen,
  useCommandPaletteQuery,
  useCommandPaletteFilter,
  type CommandFilter,
} from '@mythos/state';
import { commandRegistry, type Command } from '@mythos/commands';

const FILTER_LABELS: Record<CommandFilter, string> = {
  all: 'All',
  entity: 'Entity',
  ai: 'AI',
  navigation: 'Nav',
  general: 'General',
};

export function CommandPalette() {
  const { colors } = useTheme();
  const isOpen = useCommandPaletteOpen();
  const query = useCommandPaletteQuery();
  const filter = useCommandPaletteFilter();
  const { close, setQuery, setFilter, cycleFilter, addRecent, recentIds } = useCommandPaletteStore();
  const inputRef = useRef<TextInput>(null);

  const ctx = useMemo(() => ({ projectId: '1', hasSelection: false }), []);

  const commands = useMemo(() => {
    let list = query ? commandRegistry.search(query, ctx) : commandRegistry.list(ctx);
    if (filter !== 'all') {
      list = list.filter((cmd) => cmd.category === filter);
    }
    return list;
  }, [query, filter, ctx]);

  const recentCommands = useMemo(() => {
    if (query) return [];
    return recentIds
      .map((id) => commandRegistry.get(id))
      .filter((cmd): cmd is Command => cmd !== undefined)
      .slice(0, 3);
  }, [recentIds, query]);

  const executeCommand = useCallback((cmd: Command) => {
    addRecent(cmd.id);
    close();
    cmd.execute();
  }, [addRecent, close]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Web keyboard shortcuts
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handler = (e: KeyboardEvent) => {
      if (isOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          if (query) {
            setQuery('');
          } else {
            close();
          }
        } else if (e.key === 'Tab') {
          e.preventDefault();
          cycleFilter(e.shiftKey ? -1 : 1);
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, query, close, setQuery, cycleFilter]);

  if (!isOpen) return null;

  const showRecent = !query && recentCommands.length > 0;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
          style={[styles.container, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            {/* Search Input */}
            <View style={[styles.inputRow, { borderBottomColor: colors.border }]}>
              <Feather name="search" size={16} color={colors.textMuted} />
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={setQuery}
                placeholder="Search commands..."
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { color: colors.text }]}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={[styles.kbd, { backgroundColor: colors.bgHover }]}>
                <Text style={[styles.kbdText, { color: colors.textMuted }]}>⌘K</Text>
              </View>
            </View>

            {/* Filter Tabs */}
            <View style={[styles.filters, { borderBottomColor: colors.border }]}>
              {(Object.keys(FILTER_LABELS) as CommandFilter[]).map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setFilter(f)}
                  style={[
                    styles.filterTab,
                    filter === f && { backgroundColor: colors.accent + '20' },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      { color: filter === f ? colors.accent : colors.textMuted },
                    ]}
                  >
                    {FILTER_LABELS[f]}
                  </Text>
                </Pressable>
              ))}
              <View style={{ flex: 1 }} />
              <Text style={[styles.hint, { color: colors.textMuted }]}>Tab to filter</Text>
            </View>

            {/* Command List */}
            <FlatList
              data={showRecent ? [...recentCommands, ...commands] : commands}
              keyExtractor={(item) => item.id}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>No commands found</Text>
                </View>
              }
              renderItem={({ item, index }) => (
                <>
                  {showRecent && index === 0 && (
                    <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>RECENT</Text>
                  )}
                  {showRecent && index === recentCommands.length && (
                    <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ALL COMMANDS</Text>
                  )}
                  <CommandItem command={item} onSelect={() => executeCommand(item)} />
                </>
              )}
            />

            {/* Footer */}
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <Text style={[styles.footerText, { color: colors.textMuted }]}>↑↓ navigate</Text>
              <Text style={[styles.footerText, { color: colors.textMuted }]}>↵ select</Text>
              <Text style={[styles.footerText, { color: colors.textMuted }]}>esc close</Text>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

interface CommandItemProps {
  command: Command;
  onSelect: () => void;
}

function CommandItem({ command, onSelect }: CommandItemProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onSelect}
      style={({ pressed, hovered }) => [
        styles.item,
        (pressed || hovered) && { backgroundColor: colors.bgHover },
      ]}
    >
      {command.icon && (
        <View style={[styles.itemIcon, { backgroundColor: colors.bgHover }]}>
          <Feather name={command.icon as any} size={14} color={colors.textMuted} />
        </View>
      )}
      <View style={styles.itemContent}>
        <Text style={[styles.itemLabel, { color: colors.text }]}>{command.label}</Text>
        {command.description && (
          <Text style={[styles.itemDesc, { color: colors.textMuted }]} numberOfLines={1}>
            {command.description}
          </Text>
        )}
      </View>
      {command.shortcut && (
        <View style={[styles.kbd, { backgroundColor: colors.bgHover }]}>
          <Text style={[styles.kbdText, { color: colors.textMuted }]}>{command.shortcut}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: '15%',
  },
  container: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '70%',
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
    marginHorizontal: spacing[4],
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    fontSize: typography.base,
    paddingVertical: spacing[1],
  },
  kbd: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radii.sm,
  },
  kbdText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    gap: spacing[1],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterTab: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radii.md,
  },
  filterText: {
    fontSize: typography.xs,
  },
  hint: {
    fontSize: 10,
  },
  list: {
    maxHeight: 340,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.5,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[1],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    gap: spacing[3],
  },
  itemIcon: {
    width: 28,
    height: 28,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemContent: {
    flex: 1,
    gap: 2,
  },
  itemLabel: {
    fontSize: typography.sm,
    fontWeight: '500',
  },
  itemDesc: {
    fontSize: typography.xs,
  },
  empty: {
    padding: spacing[8],
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2],
    gap: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: {
    fontSize: 10,
  },
});
