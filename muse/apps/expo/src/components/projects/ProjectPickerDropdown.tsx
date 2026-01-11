/**
 * ProjectPickerDropdown - Notion-style workspace/project switcher
 *
 * Features:
 * - Current workspace header with settings/invite buttons
 * - List of all projects with selection indicator
 * - "+ New Workspace" button
 * - Sign out
 */

import { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, typography, radii, shadows } from '@/design-system';
import { useProjectStore } from '@mythos/state';
import { createProjectFromBootstrap } from '@mythos/core';
import { useSession, signOut } from '@/lib/auth';
import { useProjects, type Project } from '@/hooks';

interface ProjectPickerDropdownProps {
  visible: boolean;
  onClose: () => void;
  onCreateNew: () => void;
  anchorPosition?: { top: number; left: number };
}

function getProjectInitial(name?: string | null): string {
  if (!name) return '?';
  return name.trim().charAt(0).toUpperCase();
}

export function ProjectPickerDropdown({
  visible,
  onClose,
  onCreateNew,
  anchorPosition,
}: ProjectPickerDropdownProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const { data: session } = useSession();
  const { projects, isLoading } = useProjects();
  const currentProject = useProjectStore((s) => s.project);
  const setProject = useProjectStore((s) => s.setProject);

  const handleSelectProject = useCallback(
    (project: Project) => {
      // Use shared mapper to create properly typed project
      const coreProject = createProjectFromBootstrap({
        projectId: project.id,
        name: project.name,
        description: project.description,
        templateId: project.templateId,
      });

      setProject(coreProject);
      onClose();
    },
    [setProject, onClose]
  );

  const handleSignOut = useCallback(async () => {
    try {
      onClose();
      await signOut();
      router.replace('/sign-in');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  }, [onClose, router]);

  const handleSettings = useCallback(() => {
    onClose();
    router.push('/settings');
  }, [onClose, router]);

  const handleCreateNew = useCallback(() => {
    onClose();
    onCreateNew();
  }, [onClose, onCreateNew]);

  if (!visible) return null;

  const userEmail = session?.user?.email || 'User';
  const memberCount = 1; // TODO: Get actual member count

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View
          style={[
            styles.dropdown,
            {
              backgroundColor: colors.bgElevated,
              borderColor: colors.border,
              ...shadows.lg,
            },
            anchorPosition && {
              position: 'absolute',
              top: anchorPosition.top,
              left: anchorPosition.left,
            },
          ]}
        >
          {/* Current Workspace Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerContent}>
              <View style={[styles.projectAvatar, { backgroundColor: colors.bgHover }]}>
                <Text style={[styles.avatarText, { color: colors.text }]}>
                  {getProjectInitial(currentProject?.name)}
                </Text>
              </View>
              <View style={styles.headerInfo}>
                <Text style={[styles.projectTitle, { color: colors.text }]} numberOfLines={1}>
                  {currentProject?.name || 'No project selected'}
                </Text>
                <Text style={[styles.planLabel, { color: colors.textMuted }]}>
                  Free Plan · {memberCount} member
                </Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.iconButton,
                  { backgroundColor: pressed ? colors.bgHover : 'transparent' },
                ]}
                onPress={handleSettings}
              >
                <Feather name="settings" size={16} color={colors.textMuted} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.iconButton,
                  { backgroundColor: pressed ? colors.bgHover : 'transparent' },
                ]}
                disabled
              >
                <Feather name="users" size={16} color={colors.textGhost} />
              </Pressable>
            </View>
          </View>

          {/* User Section */}
          <View style={[styles.userSection, { borderBottomColor: colors.border }]}>
            <View style={styles.userRow}>
              <Text style={[styles.userEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                {userEmail}
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.moreButton,
                  { backgroundColor: pressed ? colors.bgHover : 'transparent' },
                ]}
              >
                <Feather name="more-horizontal" size={14} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>

          {/* Projects List */}
          <ScrollView style={styles.projectsList} showsVerticalScrollIndicator={false}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.textMuted} />
              </View>
            ) : projects.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No projects yet
                </Text>
              </View>
            ) : (
              projects.map((project) => {
                const isSelected = project.id === currentProject?.id;
                return (
                  <Pressable
                    key={project.id}
                    style={({ pressed, hovered }) => [
                      styles.projectItem,
                      (pressed || hovered) && { backgroundColor: colors.bgHover },
                    ]}
                    onPress={() => handleSelectProject(project)}
                  >
                    <View style={[styles.projectItemAvatar, { backgroundColor: colors.bgHover }]}>
                      <Text style={[styles.projectItemAvatarText, { color: colors.text }]}>
                        {getProjectInitial(project.name)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.projectItemName,
                        { color: isSelected ? colors.text : colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {project.name}
                    </Text>
                    {isSelected && (
                      <Feather name="check" size={16} color={colors.accent} />
                    )}
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          {/* New Workspace Button */}
          <View style={[styles.newWorkspaceSection, { borderTopColor: colors.border }]}>
            <Pressable
              style={({ pressed, hovered }) => [
                styles.newWorkspaceButton,
                (pressed || hovered) && { backgroundColor: colors.bgHover },
              ]}
              onPress={handleCreateNew}
            >
              <Feather name="plus" size={16} color={colors.accent} />
              <Text style={[styles.newWorkspaceText, { color: colors.accent }]}>
                New Workspace
              </Text>
            </Pressable>
          </View>

          {/* Footer Actions */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <Pressable
              style={({ pressed, hovered }) => [
                styles.footerButton,
                (pressed || hovered) && { backgroundColor: colors.bgHover },
              ]}
              onPress={handleSignOut}
            >
              <Feather name="log-out" size={14} color={colors.textMuted} />
              <Text style={[styles.footerButtonText, { color: colors.textSecondary }]}>
                Sign out
              </Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingTop: 60,
    paddingLeft: spacing[3],
  },
  dropdown: {
    width: 280,
    maxHeight: 480,
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    padding: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  projectAvatar: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
  },
  headerInfo: {
    flex: 1,
  },
  projectTitle: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
  },
  planLabel: {
    fontSize: typography.xs,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing[1],
    marginTop: spacing[2],
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userSection: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userEmail: {
    fontSize: typography.xs,
    flex: 1,
  },
  moreButton: {
    width: 24,
    height: 24,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectsList: {
    maxHeight: 200,
  },
  loadingContainer: {
    padding: spacing[4],
    alignItems: 'center',
  },
  emptyContainer: {
    padding: spacing[4],
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.xs,
    fontStyle: 'italic',
  },
  projectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    gap: spacing[2],
  },
  projectItemAvatar: {
    width: 24,
    height: 24,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectItemAvatarText: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
  },
  projectItemName: {
    flex: 1,
    fontSize: typography.sm,
  },
  newWorkspaceSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  newWorkspaceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    gap: spacing[2],
  },
  newWorkspaceText: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    gap: spacing[2],
  },
  footerButtonText: {
    fontSize: typography.sm,
  },
});
