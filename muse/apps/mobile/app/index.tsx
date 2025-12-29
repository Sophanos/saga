import { View, Text, Pressable, TextInput, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useState } from "react";
import { BookOpen, Plus, ArrowUp, FolderOpen, Globe, Settings as SettingsIcon } from "lucide-react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSupabaseAuthSync } from "../lib/useSupabaseAuthSync";

/**
 * Home Screen - Minimal Cursor-style design
 */

export default function HomeScreen() {
  const { user } = useSupabaseAuthSync();
  const [inputValue, setInputValue] = useState("");
  const hasContent = inputValue.trim().length > 0;

  const handleSubmit = () => {
    if (hasContent) {
      // In the future, this could create a new project or analyze the text
      router.push("/projects");
    }
  };

  // Get user's display name or email prefix
  const displayName = user?.user_metadata?.full_name
    || user?.email?.split("@")[0]
    || "Writer";

  return (
    <SafeAreaView className="flex-1 bg-mythos-bg-primary">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Animated.View
          entering={FadeIn.duration(400)}
          className="flex-row items-center justify-between px-6 py-4 border-b border-mythos-border-subtle"
        >
          <View className="flex-row items-center gap-2">
            <BookOpen size={20} color="#e4e4e7" />
            <Text className="text-base font-semibold text-mythos-text-primary">
              Mythos
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/settings")}
            className="px-3 py-1.5 rounded-full border border-mythos-border-subtle"
          >
            <Text className="text-xs text-mythos-text-secondary">Settings</Text>
          </Pressable>
        </Animated.View>

        {/* Main Content */}
        <View className="flex-1 justify-center px-6 pb-8">
          {/* Greeting */}
          <Animated.View
            entering={FadeInDown.delay(50).duration(500)}
            className="mb-2"
          >
            <Text className="text-sm text-mythos-text-muted">
              Welcome back, {displayName}
            </Text>
          </Animated.View>

          {/* Headline */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(500)}
            className="mb-10"
          >
            <Text className="text-3xl font-medium text-mythos-text-primary leading-tight mb-2">
              Structure your creative chaos.
            </Text>
            <Text className="text-base text-mythos-text-secondary leading-relaxed">
              The AI writing environment that understands your story.
            </Text>
          </Animated.View>

          {/* Input Area */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(500)}
            className="bg-mythos-bg-secondary rounded-xl border border-mythos-border-subtle p-4 mb-6"
          >
            <TextInput
              value={inputValue}
              onChangeText={setInputValue}
              placeholder="Paste your chapter or describe your story..."
              placeholderTextColor="#71717a"
              multiline
              className="text-mythos-text-primary text-base min-h-[100px] max-h-[200px]"
              style={{ textAlignVertical: "top" }}
            />
            <View className="flex-row items-center justify-between mt-4 pt-4 border-t border-mythos-border-subtle">
              <Pressable className="flex-row items-center gap-2 px-3 py-2 rounded-lg border border-mythos-border-subtle">
                <Plus size={16} color="#71717a" />
                <Text className="text-sm text-mythos-text-muted">Add file</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                className={`w-10 h-10 rounded-full items-center justify-center ${
                  hasContent ? "bg-mythos-accent-cyan" : "bg-mythos-bg-tertiary"
                }`}
                disabled={!hasContent}
              >
                <ArrowUp size={18} color={hasContent ? "#07070a" : "#71717a"} />
              </Pressable>
            </View>
          </Animated.View>

          {/* Quick Actions */}
          <Animated.View
            entering={FadeInDown.delay(300).duration(500)}
            className="flex-row flex-wrap gap-2"
          >
            <QuickAction label="Analyze chapter" />
            <QuickAction label="Find plot holes" />
            <QuickAction label="Check characters" />
          </Animated.View>
        </View>

        {/* Bottom Nav */}
        <View className="flex-row justify-around px-6 py-4 border-t border-mythos-border-subtle">
          <NavItem
            label="Home"
            icon={BookOpen}
            active
            onPress={() => {}}
          />
          <NavItem
            label="Projects"
            icon={FolderOpen}
            onPress={() => router.push("/projects")}
          />
          <NavItem
            label="World"
            icon={Globe}
            onPress={() => router.push("/world")}
          />
          <NavItem
            label="Settings"
            icon={SettingsIcon}
            onPress={() => router.push("/settings")}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({ label }: { label: string }) {
  return (
    <Pressable className="px-4 py-2 rounded-full border border-mythos-border-subtle bg-mythos-bg-secondary">
      <Text className="text-sm text-mythos-text-secondary">{label}</Text>
    </Pressable>
  );
}

function NavItem({
  label,
  icon: Icon,
  active,
  onPress,
}: {
  label: string;
  icon: typeof BookOpen;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="items-center gap-1 px-4 py-2">
      <Icon size={20} color={active ? "#22d3ee" : "#52525b"} />
      <Text className={`text-xs ${active ? "text-mythos-accent-cyan" : "text-mythos-text-muted"}`}>
        {label}
      </Text>
    </Pressable>
  );
}
