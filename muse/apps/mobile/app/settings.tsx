import { View, Text, Pressable, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  ArrowLeft,
  User,
  Key,
  Bell,
  Moon,
  HelpCircle,
  LogOut,
  ChevronRight,
} from "lucide-react-native";
import { useState } from "react";

// ============================================
// SETTINGS SCREEN
// ============================================

export default function SettingsScreen() {
  const [darkMode, setDarkMode] = useState(true);
  const [notifications, setNotifications] = useState(true);

  return (
    <SafeAreaView className="flex-1 bg-mythos-bg-primary">
      {/* Header */}
      <View className="flex-row items-center gap-3 px-6 py-4 border-b border-mythos-border-subtle">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-xl bg-mythos-bg-secondary items-center justify-center"
        >
          <ArrowLeft size={20} color="#a1a1aa" />
        </Pressable>
        <Text className="text-lg font-semibold text-mythos-text-primary">
          Settings
        </Text>
      </View>

      <ScrollView className="flex-1 px-6 py-4">
        {/* Account Section */}
        <Text className="text-xs font-medium text-mythos-text-muted mb-3 uppercase tracking-wide">
          Account
        </Text>
        <View className="bg-mythos-bg-secondary rounded-2xl border border-mythos-border-subtle mb-6 overflow-hidden">
          <SettingsItem
            icon={User}
            label="Profile"
            onPress={() => {}}
          />
          <SettingsItem
            icon={Key}
            label="API Keys"
            onPress={() => {}}
            showBorder
          />
        </View>

        {/* Preferences Section */}
        <Text className="text-xs font-medium text-mythos-text-muted mb-3 uppercase tracking-wide">
          Preferences
        </Text>
        <View className="bg-mythos-bg-secondary rounded-2xl border border-mythos-border-subtle mb-6 overflow-hidden">
          <View className="flex-row items-center justify-between px-4 py-4 border-b border-mythos-border-subtle">
            <View className="flex-row items-center gap-3">
              <View className="w-9 h-9 rounded-lg bg-mythos-bg-tertiary items-center justify-center">
                <Moon size={18} color="#a1a1aa" />
              </View>
              <Text className="text-base text-mythos-text-primary">
                Dark Mode
              </Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: "#27272a", true: "#22d3ee" }}
              thumbColor="#ffffff"
            />
          </View>
          <View className="flex-row items-center justify-between px-4 py-4">
            <View className="flex-row items-center gap-3">
              <View className="w-9 h-9 rounded-lg bg-mythos-bg-tertiary items-center justify-center">
                <Bell size={18} color="#a1a1aa" />
              </View>
              <Text className="text-base text-mythos-text-primary">
                Notifications
              </Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: "#27272a", true: "#22d3ee" }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* Support Section */}
        <Text className="text-xs font-medium text-mythos-text-muted mb-3 uppercase tracking-wide">
          Support
        </Text>
        <View className="bg-mythos-bg-secondary rounded-2xl border border-mythos-border-subtle mb-6 overflow-hidden">
          <SettingsItem
            icon={HelpCircle}
            label="Help & Feedback"
            onPress={() => {}}
          />
        </View>

        {/* Sign Out */}
        <Pressable className="flex-row items-center justify-center gap-2 py-4">
          <LogOut size={18} color="#f87171" />
          <Text className="text-base text-mythos-accent-red">Sign Out</Text>
        </Pressable>

        {/* Version */}
        <Text className="text-center text-xs text-mythos-text-muted mt-4">
          Mythos v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsItem({
  icon: Icon,
  label,
  onPress,
  showBorder = false,
}: {
  icon: typeof User;
  label: string;
  onPress: () => void;
  showBorder?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center justify-between px-4 py-4 ${
        showBorder ? "border-b border-mythos-border-subtle" : ""
      }`}
    >
      <View className="flex-row items-center gap-3">
        <View className="w-9 h-9 rounded-lg bg-mythos-bg-tertiary items-center justify-center">
          <Icon size={18} color="#a1a1aa" />
        </View>
        <Text className="text-base text-mythos-text-primary">{label}</Text>
      </View>
      <ChevronRight size={18} color="#52525b" />
    </Pressable>
  );
}
