/**
 * Settings Screen - Modal presentation
 */

import { View, Text, StyleSheet, Pressable, Switch, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, spacing, typography, radii } from '@/design-system';
import { useLayoutStore } from '@mythos/state';
import { useSession, signOut } from '@/lib/auth';

export default function SettingsScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sidebarCollapsed, toggleSidebar } = useLayoutStore();
  const { data: session } = useSession();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/');
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
      <View style={[styles.content, { paddingBottom: insets.bottom + spacing[4] }]}>
        {/* Account */}
        {session?.user && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ACCOUNT</Text>

            <View style={[styles.row, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Email</Text>
              <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                {session.user.email}
              </Text>
            </View>

            <Pressable
              onPress={handleSignOut}
              style={[styles.row, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}
            >
              <Text style={[styles.rowLabel, { color: '#ef4444' }]}>Sign Out</Text>
              <Text style={[styles.rowValue, { color: colors.textSecondary }]}>→</Text>
            </Pressable>
          </View>
        )}

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
