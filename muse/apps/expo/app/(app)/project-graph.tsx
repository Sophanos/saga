import { View, Text, StyleSheet } from 'react-native';
import { useTheme, typography } from '@/design-system';

export default function ProjectGraphScreen(): JSX.Element {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
      <Text style={[styles.text, { color: colors.textMuted }]}>
        Project Graph is available on web for now.
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
  text: {
    fontSize: typography.base,
  },
});
