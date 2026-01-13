/**
 * Settings Screen - Modal presentation
 */

import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Switch, Alert, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useAction, useConvexAuth } from 'convex/react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useTheme, spacing, typography, radii } from '@/design-system';
import { useLayoutStore } from '@mythos/state';
import { useSignOut } from '@/lib/auth';

function blurActiveElement(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }

  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement) {
    activeElement.blur();
  }
}

export default function SettingsScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sidebarCollapsed, toggleSidebar } = useLayoutStore();
  const { isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : "skip");
  const signOut = useSignOut();

  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionPreview, setDeletionPreview] = useState<{
    ownedProjectCount: number;
    sharedProjectMemberships: number;
    documentCount: number;
    entityCount: number;
  } | null>(null);

  // Convex API types are too deep for expo typecheck; treat as untyped.
  // @ts-ignore
  const apiAny: any = api;
  const getDeletePreview = useMutation(apiAny.account.getDeletePreview as any);
  const deleteMyAccount = useAction(apiAny.account.deleteMyAccount as any);

  const handleSignOut = async () => {
    try {
      blurActiveElement();
      await signOut();
      router.replace('/sign-in');
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      // Get preview of what will be deleted
      const preview = await getDeletePreview();
      setDeletionPreview(preview);

      // Show confirmation dialog
      const message = preview.ownedProjectCount > 0
        ? `This will permanently delete:\n\n• ${preview.ownedProjectCount} project${preview.ownedProjectCount !== 1 ? 's' : ''}\n• ${preview.documentCount} document${preview.documentCount !== 1 ? 's' : ''}\n• ${preview.entityCount} entit${preview.entityCount !== 1 ? 'ies' : 'y'}\n\nYou will also be removed from ${preview.sharedProjectMemberships} shared project${preview.sharedProjectMemberships !== 1 ? 's' : ''}.\n\nThis action cannot be undone.`
        : 'This will permanently delete your account. This action cannot be undone.';

      Alert.alert(
        'Delete Account',
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: confirmDelete,
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to get account information. Please try again.');
    }
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteMyAccount();
      blurActiveElement();
      await signOut();
      router.replace('/sign-in');
      Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
    } catch (error) {
      Alert.alert('Error', 'Failed to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
      <View style={[styles.content, { paddingBottom: insets.bottom + spacing[4] }]}>
        {/* Account */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ACCOUNT</Text>

          {currentUser ? (
            <>
              <View style={[styles.row, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>Email</Text>
                <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                  {currentUser.email ?? ""}
                </Text>
              </View>

              <Pressable
                onPress={handleSignOut}
                testID="auth-sign-out"
                accessibilityLabel="Sign Out"
                style={[styles.row, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}
              >
                <Text style={[styles.rowLabel, { color: '#ef4444' }]}>Sign Out</Text>
                <Text style={[styles.rowValue, { color: colors.textSecondary }]}>→</Text>
              </Pressable>

              <Pressable
                onPress={handleDeleteAccount}
                disabled={isDeleting}
                style={[
                  styles.row,
                  {
                    backgroundColor: colors.bgSurface,
                    borderColor: colors.border,
                    opacity: isDeleting ? 0.5 : 1,
                  },
                ]}
              >
                <Text style={[styles.rowLabel, { color: '#dc2626' }]}>Delete Account</Text>
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#dc2626" />
                ) : (
                  <Text style={[styles.rowValue, { color: colors.textSecondary }]}>→</Text>
                )}
              </Pressable>
            </>
          ) : (
            <View style={[styles.row, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}>
              <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Not signed in</Text>
            </View>
          )}
        </View>

        {/* Appearance */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>APPEARANCE</Text>

          <View style={[styles.row, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Theme</Text>
            <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
              {isDark ? 'Dark' : 'Light'} (System)
            </Text>
          </View>

          <View style={[styles.row, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Sidebar Collapsed</Text>
            <Switch value={sidebarCollapsed} onValueChange={toggleSidebar} />
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ABOUT</Text>

          <View style={[styles.row, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Version</Text>
            <Text style={[styles.rowValue, { color: colors.textSecondary }]}>1.0.0</Text>
          </View>

          <Pressable
            style={[styles.row, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}
          >
            <Text style={[styles.rowLabel, { color: colors.text }]}>Privacy Policy</Text>
            <Text style={[styles.rowValue, { color: colors.textSecondary }]}>→</Text>
          </Pressable>
        </View>

        {/* Close button for web */}
        <Pressable
          onPress={() => router.back()}
          style={[styles.closeButton, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}
        >
          <Text style={[styles.closeButtonText, { color: colors.text }]}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: spacing[4],
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: typography.medium,
    letterSpacing: 0.5,
    marginBottom: spacing[2],
    paddingHorizontal: spacing[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing[2],
  },
  rowLabel: {
    fontSize: typography.base,
  },
  rowValue: {
    fontSize: typography.sm,
  },
  closeButton: {
    padding: spacing[4],
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 'auto',
  },
  closeButtonText: {
    fontSize: typography.base,
    fontWeight: typography.medium,
  },
});
