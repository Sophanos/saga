/**
 * RegistryEditorModal - Placeholder for entity/relationship type registry editor (Expo)
 *
 * Allows customizing entity types, their colors, icons, and schemas.
 */

import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, TextInput } from 'react-native';
import Animated, { FadeIn, SlideInUp } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, radii, typography, shadows } from '@/design-system';

interface RegistryEditorModalProps {
  onClose: () => void;
}

type TabId = 'entities' | 'relationships';

interface EntityTypeDef {
  id: string;
  name: string;
  pluralName: string;
  icon: string;
  color: string;
  riskLevel: 'low' | 'high';
  isIdentity: boolean;
}

interface RelationshipTypeDef {
  id: string;
  name: string;
  forwardLabel: string;
  reverseLabel: string;
  allowedSources: string[];
  allowedTargets: string[];
}

// Mock data - will be replaced with real registry data
const MOCK_ENTITY_TYPES: EntityTypeDef[] = [
  { id: 'character', name: 'Character', pluralName: 'Characters', icon: 'user', color: '#8b5cf6', riskLevel: 'high', isIdentity: true },
  { id: 'location', name: 'Location', pluralName: 'Locations', icon: 'map-pin', color: '#22c55e', riskLevel: 'low', isIdentity: false },
  { id: 'item', name: 'Item', pluralName: 'Items', icon: 'box', color: '#f59e0b', riskLevel: 'low', isIdentity: false },
  { id: 'event', name: 'Event', pluralName: 'Events', icon: 'calendar', color: '#3b82f6', riskLevel: 'low', isIdentity: false },
  { id: 'faction', name: 'Faction', pluralName: 'Factions', icon: 'flag', color: '#ec4899', riskLevel: 'low', isIdentity: true },
];

const MOCK_RELATIONSHIP_TYPES: RelationshipTypeDef[] = [
  { id: 'knows', name: 'Knows', forwardLabel: 'knows', reverseLabel: 'is known by', allowedSources: ['character'], allowedTargets: ['character'] },
  { id: 'located_at', name: 'Located At', forwardLabel: 'is at', reverseLabel: 'contains', allowedSources: ['character', 'item'], allowedTargets: ['location'] },
  { id: 'member_of', name: 'Member Of', forwardLabel: 'belongs to', reverseLabel: 'has member', allowedSources: ['character'], allowedTargets: ['faction'] },
  { id: 'owns', name: 'Owns', forwardLabel: 'owns', reverseLabel: 'owned by', allowedSources: ['character'], allowedTargets: ['item'] },
];

const AVAILABLE_ICONS = ['user', 'map-pin', 'box', 'calendar', 'flag', 'book', 'star', 'heart', 'zap', 'shield', 'award', 'compass'];

const COLOR_PALETTE = [
  '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b',
  '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#6366f1', '#a855f7', '#d946ef', '#64748b',
];

export function RegistryEditorModal({ onClose }: RegistryEditorModalProps) {
  const { colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<TabId>('entities');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(MOCK_ENTITY_TYPES[0]?.id ?? null);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string | null>(MOCK_RELATIONSHIP_TYPES[0]?.id ?? null);

  const selectedEntity = useMemo(
    () => MOCK_ENTITY_TYPES.find((e) => e.id === selectedEntityId),
    [selectedEntityId]
  );

  const selectedRelationship = useMemo(
    () => MOCK_RELATIONSHIP_TYPES.find((r) => r.id === selectedRelationshipId),
    [selectedRelationshipId]
  );

  const tabs: { id: TabId; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { id: 'entities', label: 'Entity Types', icon: 'layers' },
    { id: 'relationships', label: 'Relationships', icon: 'git-branch' },
  ];

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        entering={FadeIn.duration(200)}
        style={[styles.backdrop, { backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.5)' }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View
          entering={SlideInUp.duration(300).springify().damping(18)}
          style={[
            styles.modal,
            shadows.lg,
            {
              backgroundColor: colors.bgElevated,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              <Feather name="settings" size={18} color={colors.accent} />
              <Text style={[styles.title, { color: colors.text }]}>Project Registry</Text>
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed, hovered }) => [
                styles.closeButton,
                {
                  backgroundColor: hovered || pressed
                    ? isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
                    : 'transparent',
                },
              ]}
            >
              <Feather name="x" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Tab bar */}
          <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
            {tabs.map((tab) => (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={({ pressed }) => [
                  styles.tab,
                  activeTab === tab.id && { borderBottomColor: colors.accent },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Feather
                  name={tab.icon}
                  size={14}
                  color={activeTab === tab.id ? colors.accent : colors.textMuted}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    { color: activeTab === tab.id ? colors.text : colors.textMuted },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Content */}
          <View style={styles.content}>
            {activeTab === 'entities' ? (
              <View style={styles.splitView}>
                {/* Entity type list */}
                <View style={[styles.typeList, { borderRightColor: colors.border }]}>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {MOCK_ENTITY_TYPES.map((type) => (
                      <Pressable
                        key={type.id}
                        onPress={() => setSelectedEntityId(type.id)}
                        style={({ hovered }) => [
                          styles.typeItem,
                          selectedEntityId === type.id && { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
                          hovered && { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' },
                        ]}
                      >
                        <View style={[styles.typeIcon, { backgroundColor: type.color + '20' }]}>
                          <Feather name={type.icon as keyof typeof Feather.glyphMap} size={14} color={type.color} />
                        </View>
                        <Text style={[styles.typeName, { color: colors.text }]}>{type.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <Pressable
                    style={({ hovered }) => [
                      styles.addButton,
                      { borderColor: colors.border },
                      hovered && { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' },
                    ]}
                  >
                    <Feather name="plus" size={14} color={colors.textMuted} />
                    <Text style={[styles.addText, { color: colors.textMuted }]}>Add Type</Text>
                  </Pressable>
                </View>

                {/* Entity editor */}
                {selectedEntity && (
                  <ScrollView style={styles.editor} showsVerticalScrollIndicator={false}>
                    <View style={styles.editorSection}>
                      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Name</Text>
                      <TextInput
                        value={selectedEntity.name}
                        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bgSurface }]}
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>

                    <View style={styles.editorSection}>
                      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Plural Name</Text>
                      <TextInput
                        value={selectedEntity.pluralName}
                        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bgSurface }]}
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>

                    <View style={styles.editorSection}>
                      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Icon</Text>
                      <View style={styles.iconGrid}>
                        {AVAILABLE_ICONS.map((icon) => (
                          <Pressable
                            key={icon}
                            style={[
                              styles.iconOption,
                              { borderColor: colors.border },
                              selectedEntity.icon === icon && { borderColor: colors.accent, backgroundColor: colors.accent + '15' },
                            ]}
                          >
                            <Feather name={icon as keyof typeof Feather.glyphMap} size={16} color={selectedEntity.icon === icon ? colors.accent : colors.textMuted} />
                          </Pressable>
                        ))}
                      </View>
                    </View>

                    <View style={styles.editorSection}>
                      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Color</Text>
                      <View style={styles.colorGrid}>
                        {COLOR_PALETTE.map((color) => (
                          <Pressable
                            key={color}
                            style={[
                              styles.colorOption,
                              { backgroundColor: color },
                              selectedEntity.color === color && styles.colorSelected,
                            ]}
                          >
                            {selectedEntity.color === color && (
                              <Feather name="check" size={12} color="#fff" />
                            )}
                          </Pressable>
                        ))}
                      </View>
                    </View>

                    <View style={styles.editorSection}>
                      <View style={styles.toggleRow}>
                        <View>
                          <Text style={[styles.toggleLabel, { color: colors.text }]}>Identity Entity</Text>
                          <Text style={[styles.toggleDescription, { color: colors.textMuted }]}>
                            Can have aliases and be referred to by multiple names
                          </Text>
                        </View>
                        <View style={[styles.toggle, selectedEntity.isIdentity && styles.toggleActive, { borderColor: colors.border }]}>
                          <View style={[styles.toggleKnob, selectedEntity.isIdentity && styles.toggleKnobActive]} />
                        </View>
                      </View>
                    </View>

                    <View style={styles.editorSection}>
                      <View style={styles.toggleRow}>
                        <View>
                          <Text style={[styles.toggleLabel, { color: colors.text }]}>High Risk</Text>
                          <Text style={[styles.toggleDescription, { color: colors.textMuted }]}>
                            Require review before AI can modify
                          </Text>
                        </View>
                        <View style={[styles.toggle, selectedEntity.riskLevel === 'high' && styles.toggleActive, { borderColor: colors.border }]}>
                          <View style={[styles.toggleKnob, selectedEntity.riskLevel === 'high' && styles.toggleKnobActive]} />
                        </View>
                      </View>
                    </View>
                  </ScrollView>
                )}
              </View>
            ) : (
              <View style={styles.splitView}>
                {/* Relationship type list */}
                <View style={[styles.typeList, { borderRightColor: colors.border }]}>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {MOCK_RELATIONSHIP_TYPES.map((type) => (
                      <Pressable
                        key={type.id}
                        onPress={() => setSelectedRelationshipId(type.id)}
                        style={({ hovered }) => [
                          styles.typeItem,
                          selectedRelationshipId === type.id && { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
                          hovered && { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' },
                        ]}
                      >
                        <View style={[styles.typeIcon, { backgroundColor: colors.accent + '20' }]}>
                          <Feather name="git-branch" size={14} color={colors.accent} />
                        </View>
                        <Text style={[styles.typeName, { color: colors.text }]}>{type.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <Pressable
                    style={({ hovered }) => [
                      styles.addButton,
                      { borderColor: colors.border },
                      hovered && { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' },
                    ]}
                  >
                    <Feather name="plus" size={14} color={colors.textMuted} />
                    <Text style={[styles.addText, { color: colors.textMuted }]}>Add Type</Text>
                  </Pressable>
                </View>

                {/* Relationship editor */}
                {selectedRelationship && (
                  <ScrollView style={styles.editor} showsVerticalScrollIndicator={false}>
                    <View style={styles.editorSection}>
                      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Name</Text>
                      <TextInput
                        value={selectedRelationship.name}
                        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bgSurface }]}
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>

                    <View style={styles.editorSection}>
                      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Forward Label</Text>
                      <TextInput
                        value={selectedRelationship.forwardLabel}
                        placeholder="e.g., 'knows'"
                        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bgSurface }]}
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>

                    <View style={styles.editorSection}>
                      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Reverse Label</Text>
                      <TextInput
                        value={selectedRelationship.reverseLabel}
                        placeholder="e.g., 'is known by'"
                        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bgSurface }]}
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>

                    <View style={[styles.previewCard, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}>
                      <Text style={[styles.previewLabel, { color: colors.textMuted }]}>Preview</Text>
                      <View style={styles.previewRow}>
                        <Text style={[styles.previewEntity, { color: colors.accent }]}>Alice</Text>
                        <Text style={[styles.previewVerb, { color: colors.text }]}>{selectedRelationship.forwardLabel}</Text>
                        <Text style={[styles.previewEntity, { color: colors.accent }]}>Bob</Text>
                      </View>
                      <View style={styles.previewRow}>
                        <Text style={[styles.previewEntity, { color: colors.accent }]}>Bob</Text>
                        <Text style={[styles.previewVerb, { color: colors.text }]}>{selectedRelationship.reverseLabel}</Text>
                        <Text style={[styles.previewEntity, { color: colors.accent }]}>Alice</Text>
                      </View>
                    </View>
                  </ScrollView>
                )}
              </View>
            )}
          </View>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <Pressable
              onPress={onClose}
              style={({ pressed, hovered }) => [
                styles.cancelButton,
                { borderColor: colors.border },
                (hovered || pressed) && { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' },
              ]}
            >
              <Text style={[styles.cancelText, { color: colors.textMuted }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed, hovered }) => [
                styles.saveButton,
                { backgroundColor: hovered || pressed ? colors.accentHover : colors.accent },
              ]}
            >
              <Text style={styles.saveText}>Save Changes</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[4],
  },
  modal: {
    width: '100%',
    maxWidth: 700,
    maxHeight: '90%',
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  title: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    borderBottomWidth: 1,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[3],
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabLabel: {
    fontSize: typography.sm,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    minHeight: 400,
  },
  splitView: {
    flex: 1,
    flexDirection: 'row',
  },
  typeList: {
    width: 180,
    borderRightWidth: 1,
    paddingVertical: spacing[2],
  },
  typeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
  },
  typeIcon: {
    width: 28,
    height: 28,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeName: {
    fontSize: typography.sm,
    fontWeight: '500',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1.5],
    marginHorizontal: spacing[3],
    marginTop: spacing[2],
    paddingVertical: spacing[2],
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addText: {
    fontSize: typography.xs,
    fontWeight: '500',
  },
  editor: {
    flex: 1,
    padding: spacing[4],
  },
  editorSection: {
    marginBottom: spacing[4],
  },
  sectionLabel: {
    fontSize: typography.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[2],
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing[3],
    fontSize: typography.sm,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  iconOption: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  colorOption: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSelected: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    fontSize: typography.sm,
    fontWeight: '500',
  },
  toggleDescription: {
    fontSize: typography.xs,
    marginTop: spacing[0.5],
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: radii.full,
    borderWidth: 1,
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  toggleKnob: {
    width: 18,
    height: 18,
    borderRadius: radii.full,
    backgroundColor: '#94a3b8',
  },
  toggleKnobActive: {
    backgroundColor: '#fff',
    alignSelf: 'flex-end',
  },
  previewCard: {
    marginTop: spacing[4],
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  previewLabel: {
    fontSize: typography.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[2],
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  previewEntity: {
    fontSize: typography.sm,
    fontWeight: '600',
  },
  previewVerb: {
    fontSize: typography.sm,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing[2],
    padding: spacing[4],
    borderTopWidth: 1,
  },
  cancelButton: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: radii.md,
    borderWidth: 1,
  },
  cancelText: {
    fontSize: typography.sm,
    fontWeight: '500',
  },
  saveButton: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: radii.md,
  },
  saveText: {
    color: '#fff',
    fontSize: typography.sm,
    fontWeight: '600',
  },
});
