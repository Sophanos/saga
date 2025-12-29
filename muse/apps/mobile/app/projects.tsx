import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { FolderOpen, Plus, ArrowLeft, Clock, Tag } from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

// ============================================
// PROJECTS SCREEN
// ============================================

const MOCK_PROJECTS = [
  {
    id: "1",
    name: "The Last Kingdom",
    description: "A fantasy epic about a fallen empire",
    genre: "Fantasy",
    updatedAt: "2h ago",
  },
  {
    id: "2",
    name: "Neon Shadows",
    description: "Cyberpunk noir detective story",
    genre: "Sci-Fi",
    updatedAt: "1d ago",
  },
  {
    id: "3",
    name: "Whispers in the Dark",
    description: "Psychological horror anthology",
    genre: "Horror",
    updatedAt: "3d ago",
  },
];

export default function ProjectsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-mythos-bg-primary">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-mythos-border-subtle">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-xl bg-mythos-bg-secondary items-center justify-center"
          >
            <ArrowLeft size={20} color="#a1a1aa" />
          </Pressable>
          <View>
            <Text className="text-lg font-semibold text-mythos-text-primary">
              Projects
            </Text>
            <Text className="text-xs text-mythos-text-muted">
              {MOCK_PROJECTS.length} stories
            </Text>
          </View>
        </View>
        <Pressable className="flex-row items-center gap-2 px-4 py-2.5 rounded-xl bg-mythos-accent-cyan">
          <Plus size={18} color="#07070a" />
          <Text className="text-sm font-medium text-mythos-bg-primary">
            New
          </Text>
        </Pressable>
      </View>

      {/* Project List */}
      <ScrollView className="flex-1 px-6 py-4">
        {MOCK_PROJECTS.map((project, index) => (
          <Animated.View
            key={project.id}
            entering={FadeInDown.delay(index * 100).duration(400)}
          >
            <Pressable
              onPress={() => router.push(`/editor/${project.id}`)}
              className="bg-mythos-bg-secondary rounded-2xl p-5 mb-3 border border-mythos-border-subtle active:border-mythos-accent-cyan/50"
            >
              <View className="flex-row items-start gap-3">
                <View className="w-12 h-12 rounded-xl bg-mythos-bg-tertiary items-center justify-center">
                  <FolderOpen size={24} color="#22d3ee" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-mythos-text-primary mb-1">
                    {project.name}
                  </Text>
                  <Text className="text-sm text-mythos-text-muted mb-3">
                    {project.description}
                  </Text>
                  <View className="flex-row items-center gap-4">
                    <View className="flex-row items-center gap-1">
                      <Tag size={12} color="#52525b" />
                      <Text className="text-xs text-mythos-text-muted uppercase">
                        {project.genre}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                      <Clock size={12} color="#52525b" />
                      <Text className="text-xs text-mythos-text-muted">
                        {project.updatedAt}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
