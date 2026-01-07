import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/design-system';
import { AIPanel } from '@/components/ai';
import { useEffect } from 'react';
import { useAIStore } from '@/stores/ai';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { selectThread, createThread } = useAIStore();

  useEffect(() => {
    if (id === 'new') {
      createThread();
    } else if (id) {
      selectThread(id);
    }
  }, [id, selectThread, createThread]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
      <AIPanel />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
