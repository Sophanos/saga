/**
 * Sidebar - Perplexity/Notion style
 * Global view: Home, Search, AI, Spaces (projects)
 * Project view: Story tree, World entities
 */

import { View, Text, Pressable, ScrollView, StyleSheet, Modal } from 'react-native';
import { useState, useMemo } from 'react';
import { useTheme, spacing, sizing, typography, radii, entityColors } from '@/design-system';
import { useLayoutStore } from '@/design-system/layout';

// Entity type config - centralized
const ENTITY_TYPES = [
  { type: 'character', icon: '🎭', label: 'Character', kbd: '⌘C' },
  { type: 'location', icon: '🗺', label: 'Location', kbd: '' },
  { type: 'item', icon: '⚔️', label: 'Item', kbd: '' },
  { type: 'magic', icon: '✨', label: 'Magic System', kbd: '' },
  { type: 'faction', icon: '👥', label: 'Faction', kbd: '' },
  { type: 'event', icon: '📅', label: 'Event', kbd: '' },
  { type: 'concept', icon: '💡', label: 'Concept', kbd: '' },
] as const;

export function Sidebar() {
  const { colors } = useTheme();
  const { viewMode, currentProjectId, sidebarCollapsed, toggleSidebar, exitProject, setAIPanelMode } = useLayoutStore();
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  if (sidebarCollapsed) {
    return <CollapsedSidebar />;
  }

  return (
    <View style={[styles.container, { borderRightColor: colors.border }]}>
      {/* Header - Project Switcher */}
      <View style={styles.header}>
        <Text style={[styles.logo, { color: colors.text }]}>📖 Mythos IDE</Text>
      </View>

      {/* Project Picker Row */}
      <View style={styles.projectRow}>
        <Pressable
          onPress={() => setProjectMenuOpen(true)}
          style={[styles.projectPicker, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}
        >
          <View style={[styles.projectInitial, { backgroundColor: colors.bgHover }]}>
            <Text style={[styles.projectInitialText, { color: colors.text }]}>L</Text>
          </View>
          <Text style={[styles.projectName, { color: colors.text }]} numberOfLines={1}>
            LOTR_SLAVIC
          </Text>
          <Text style={{ color: colors.textMuted }}>▾</Text>
        </Pressable>

        {/* New Chapter */}
        <Pressable style={[styles.iconBtn, { borderColor: colors.border }]}>
          <Text style={{ color: colors.textMuted }}>📄+</Text>
        </Pressable>

        {/* Create Menu */}
        <Pressable
          onPress={() => setCreateMenuOpen(true)}
          style={[styles.iconBtn, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textMuted }}>▾</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <ProjectView />
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <SidebarItem icon="⌘" label="Shortcuts" onPress={() => {}} />
        <SidebarItem icon="⚙" label="Settings" onPress={() => {/* openModal settings */}} />
      </View>

      {/* Project Switcher Modal */}
      <ProjectSwitcherModal
        visible={projectMenuOpen}
        onClose={() => setProjectMenuOpen(false)}
      />

      {/* Create Entity Modal */}
      <CreateEntityModal
        visible={createMenuOpen}
        onClose={() => setCreateMenuOpen(false)}
      />
    </View>
  );
}

function CollapsedSidebar() {
  const { colors } = useTheme();
  const { toggleSidebar } = useLayoutStore();

  return (
    <View style={[styles.collapsed, { borderRightColor: colors.border }]}>
      <Pressable onPress={toggleSidebar} style={styles.collapsedBtn}>
        <Text style={{ color: colors.textMuted }}>≡</Text>
      </Pressable>
    </View>
  );
}

// Project Switcher Dropdown
function ProjectSwitcherModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();

  // Mock data - replace with Convex
  const projects = [
    { id: '1', name: 'LOTR_SLAVIC', initial: 'L' },
    { id: '2', name: 'Sci-Fi Short', initial: 'S' },
  ];
  const currentProjectId = '1';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <View style={[styles.dropdown, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
          {/* Current project header */}
          <View style={[styles.dropdownHeader, { borderBottomColor: colors.border }]}>
            <View style={styles.dropdownHeaderRow}>
              <View style={[styles.projectInitial, { backgroundColor: colors.bgHover }]}>
                <Text style={[styles.projectInitialText, { color: colors.text }]}>L</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dropdownTitle, { color: colors.text }]}>LOTR_SLAVIC</Text>
                <Text style={[styles.dropdownSubtitle, { color: colors.textMuted }]}>Free Plan</Text>
              </View>
              <Pressable style={styles.headerIconBtn} onPress={() => {/* settings */}}>
                <Text style={{ color: colors.textMuted }}>⚙</Text>
              </Pressable>
              <Pressable style={styles.headerIconBtn} onPress={() => {/* invite */}}>
                <Text style={{ color: colors.textMuted }}>👥</Text>
              </Pressable>
            </View>
          </View>

          {/* Projects list */}
          <View style={styles.dropdownSection}>
            <Text style={[styles.dropdownSectionTitle, { color: colors.textMuted }]}>PROJECTS</Text>
            {projects.map((p) => (
              <Pressable
                key={p.id}
                style={[styles.dropdownItem, p.id === currentProjectId && { backgroundColor: colors.bgHover }]}
                onPress={() => {
                  // setSelectedProject(p.id)
                  onClose();
                }}
              >
                <View style={[styles.projectInitialSmall, { backgroundColor: colors.bgHover }]}>
                  <Text style={[styles.projectInitialTextSmall, { color: colors.text }]}>{p.initial}</Text>
                </View>
                <Text style={[styles.dropdownItemText, { color: colors.textSecondary }]}>{p.name}</Text>
                {p.id === currentProjectId && <Text style={{ color: colors.accent }}>✓</Text>}
              </Pressable>
            ))}
          </View>

          {/* New project */}
          <View style={[styles.dropdownFooter, { borderTopColor: colors.border }]}>
            <Pressable style={styles.dropdownItem} onPress={() => {/* new project */}}>
              <Text style={{ color: colors.accent }}>📁+ New Project</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

// Create Entity Dropdown
function CreateEntityModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();

  const handleCreate = (type: string) => {
    // openModal({ type: 'entityForm', mode: 'create', entityType: type })
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <View style={[styles.dropdown, styles.dropdownRight, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
          <Text style={[styles.dropdownSectionTitle, { color: colors.textMuted, paddingHorizontal: spacing[3], paddingTop: spacing[3] }]}>
            CREATE
          </Text>
          {ENTITY_TYPES.map((entity) => (
            <Pressable
              key={entity.type}
              style={styles.dropdownItem}
              onPress={() => handleCreate(entity.type)}
            >
              <Text style={styles.entityIcon}>{entity.icon}</Text>
              <Text style={[styles.dropdownItemText, { color: colors.textSecondary, flex: 1 }]}>
                {entity.label}
              </Text>
              {entity.kbd && <Text style={[styles.kbd, { color: colors.textMuted }]}>{entity.kbd}</Text>}
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

function ProjectView() {
  const { setAIPanelMode } = useLayoutStore();
  const { colors } = useTheme();
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({ ch1: true });

  // Mock data - replace with Convex query
  const recentDocs = [{ id: 'r1', title: 'Chapter 1' }];
  const chapters = [
    { id: 'ch1', title: 'Chapter 1', scenes: [{ id: 'sc1', title: 'Scene 1' }] },
  ];
  const characters: any[] = [];
  const worldEntities: any[] = [];

  const toggleChapter = (id: string) => {
    setExpandedChapters((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <>
      {/* Recents */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>RECENTS</Text>
        {recentDocs.map((doc) => (
          <SidebarItem key={doc.id} icon="C" label={doc.title} onPress={() => {}} />
        ))}
      </View>

      {/* Chapters */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>CHAPTERS</Text>
        {chapters.map((ch) => (
          <View key={ch.id}>
            <View style={styles.chapterRow}>
              <Pressable onPress={() => toggleChapter(ch.id)} style={styles.expandBtn}>
                <Text style={{ color: colors.textMuted }}>{expandedChapters[ch.id] ? '▼' : '▶'}</Text>
              </Pressable>
              <SidebarItem icon="C" label={ch.title} onPress={() => {}} active />
            </View>
            {expandedChapters[ch.id] && (
              <View style={[styles.scenesContainer, { borderLeftColor: colors.border }]}>
                <Text style={[styles.scenesLabel, { color: colors.textMuted }]}>SCENES</Text>
                {ch.scenes.map((sc) => (
                  <SidebarItem key={sc.id} icon="●" label={sc.title} onPress={() => {}} small />
                ))}
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Characters */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>CHARACTERS</Text>
          <Pressable><Text style={{ color: colors.textMuted }}>+</Text></Pressable>
        </View>
        {characters.length === 0 && (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No characters yet.</Text>
        )}
      </View>

      {/* World */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>WORLD</Text>
          <Pressable><Text style={{ color: colors.textMuted }}>+</Text></Pressable>
        </View>
        {worldEntities.length === 0 && (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No world entities yet.</Text>
        )}
      </View>
    </>
  );
}

interface SidebarItemProps {
  icon: string;
  label: string;
  onPress: () => void;
  active?: boolean;
  small?: boolean;
}

function SidebarItem({ icon, label, onPress, active, small }: SidebarItemProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }) => [
        styles.item,
        active && { backgroundColor: colors.sidebarItemActive },
        hovered && { backgroundColor: colors.sidebarItemHover },
      ]}
    >
      <View style={[styles.itemIcon, { backgroundColor: colors.bgHover }]}>
        <Text style={[styles.itemIconText, { color: colors.text }, small && { fontSize: 8 }]}>{icon}</Text>
      </View>
      <Text style={[styles.itemLabel, { color: colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, borderRightWidth: 1 },
  collapsed: { flex: 1, alignItems: 'center', paddingTop: spacing[4], borderRightWidth: 1 },
  collapsedBtn: { padding: spacing[2] },
  header: { paddingHorizontal: spacing[3], paddingVertical: spacing[3] },
  logo: { fontSize: typography.base, fontWeight: typography.semibold as any },
  projectRow: { flexDirection: 'row', paddingHorizontal: spacing[3], gap: spacing[2], marginBottom: spacing[3] },
  projectPicker: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radii.md, borderWidth: 1 },
  projectInitial: { width: 28, height: 28, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  projectInitialText: { fontSize: typography.xs, fontWeight: typography.semibold as any },
  projectInitialSmall: { width: 24, height: 24, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  projectInitialTextSmall: { fontSize: 10, fontWeight: typography.semibold as any },
  projectName: { flex: 1, fontSize: typography.sm, fontWeight: typography.medium as any },
  iconBtn: { width: 36, height: 36, borderRadius: radii.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  section: { paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: spacing[2] },
  sectionTitle: { fontSize: 11, fontWeight: typography.medium as any, letterSpacing: 0.5, paddingVertical: spacing[2] },
  chapterRow: { flexDirection: 'row', alignItems: 'center' },
  expandBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  scenesContainer: { marginLeft: spacing[5], paddingLeft: spacing[3], borderLeftWidth: 1, marginTop: spacing[1] },
  scenesLabel: { fontSize: 10, letterSpacing: 0.5, paddingVertical: spacing[1] },
  emptyText: { fontSize: typography.xs, paddingLeft: spacing[2] },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[2], paddingVertical: spacing[2], borderRadius: radii.md, gap: spacing[2] },
  itemIcon: { width: 24, height: 24, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  itemIconText: { fontSize: 11, fontWeight: typography.semibold as any },
  itemLabel: { flex: 1, fontSize: typography.sm },
  footer: { borderTopWidth: 1, paddingVertical: spacing[2], paddingHorizontal: spacing[3] },
  // Modals
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  dropdown: { position: 'absolute', left: spacing[3], top: 100, width: 280, borderRadius: radii.lg, borderWidth: 1, overflow: 'hidden' },
  dropdownRight: { left: 'auto', right: spacing[3], width: 220 },
  dropdownHeader: { padding: spacing[3], borderBottomWidth: 1 },
  dropdownHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dropdownTitle: { fontSize: typography.sm, fontWeight: typography.semibold as any },
  dropdownSubtitle: { fontSize: 11 },
  headerIconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  dropdownSection: { paddingVertical: spacing[2] },
  dropdownSectionTitle: { fontSize: 11, letterSpacing: 0.5, paddingHorizontal: spacing[3], paddingBottom: spacing[2] },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  dropdownItemText: { fontSize: typography.sm },
  dropdownFooter: { borderTopWidth: 1, paddingVertical: spacing[2] },
  entityIcon: { width: 20, textAlign: 'center' },
  kbd: { fontSize: 11, fontFamily: 'monospace' },
});
