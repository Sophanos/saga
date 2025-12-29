import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { FolderOpen, Plus, ArrowLeft, Clock, Tag, AlertCircle } from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useEffect, useState, useCallback } from "react";
import { formatRelativeTime } from "@mythos/core";
import { getMobileSupabase, type Database } from "../lib/supabase";
import { useSupabaseAuthSync } from "../lib/useSupabaseAuthSync";

// ============================================
// PROJECTS SCREEN
// ============================================

type Project = Database["public"]["Tables"]["projects"]["Row"];

export default function ProjectsScreen() {
  const { user } = useSupabaseAuthSync();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);

      const supabase = getMobileSupabase();

      // First try to get projects where user is a member
      const { data: memberProjects, error: memberError } = await supabase
        .from("project_members")
        .select("project_id")
        .eq("user_id", user.id);

      if (memberError) {
        console.warn("[Projects] Failed to fetch member projects:", memberError.message);
      }

      const memberProjectIds = (memberProjects as { project_id: string }[] | null)?.map((m) => m.project_id) || [];

      // Fetch projects owned by user OR where user is a member
      let query = supabase
        .from("projects")
        .select("*")
        .order("updated_at", { ascending: false });

      if (memberProjectIds.length > 0) {
        // User owns OR is member of
        query = query.or(`user_id.eq.${user.id},id.in.(${memberProjectIds.join(",")})`);
      } else {
        // Only user-owned projects
        query = query.eq("user_id", user.id);
      }

      const { data, error: projectsError } = await query;

      if (projectsError) {
        throw new Error(projectsError.message);
      }

      setProjects(data || []);
    } catch (err) {
      console.error("[Projects] Error fetching projects:", err);
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-mythos-bg-primary">
        <View className="flex-row items-center gap-3 px-6 py-4 border-b border-mythos-border-subtle">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-xl bg-mythos-bg-secondary items-center justify-center"
          >
            <ArrowLeft size={20} color="#a1a1aa" />
          </Pressable>
          <Text className="text-lg font-semibold text-mythos-text-primary">
            Projects
          </Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#22d3ee" />
          <Text className="text-sm text-mythos-text-muted mt-3">Loading projects...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-mythos-bg-primary">
        <View className="flex-row items-center gap-3 px-6 py-4 border-b border-mythos-border-subtle">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-xl bg-mythos-bg-secondary items-center justify-center"
          >
            <ArrowLeft size={20} color="#a1a1aa" />
          </Pressable>
          <Text className="text-lg font-semibold text-mythos-text-primary">
            Projects
          </Text>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-14 h-14 rounded-2xl bg-mythos-accent-red/20 items-center justify-center mb-4">
            <AlertCircle size={28} color="#f87171" />
          </View>
          <Text className="text-base font-medium text-mythos-text-primary mb-2">
            Failed to load projects
          </Text>
          <Text className="text-sm text-mythos-text-muted text-center mb-6">
            {error}
          </Text>
          <Pressable
            onPress={fetchProjects}
            className="px-6 py-3 rounded-xl bg-mythos-accent-cyan"
          >
            <Text className="text-sm font-medium text-mythos-bg-primary">Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

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
              {projects.length} {projects.length === 1 ? "story" : "stories"}
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
        {projects.length === 0 ? (
          <View className="items-center justify-center py-12">
            <View className="w-16 h-16 rounded-2xl bg-mythos-bg-secondary items-center justify-center mb-4">
              <FolderOpen size={32} color="#52525b" />
            </View>
            <Text className="text-base font-medium text-mythos-text-primary mb-2">
              No projects yet
            </Text>
            <Text className="text-sm text-mythos-text-muted text-center">
              Create your first project to start writing
            </Text>
          </View>
        ) : (
          projects.map((project, index) => (
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
                    <Text className="text-sm text-mythos-text-muted mb-3" numberOfLines={2}>
                      {project.description || "No description"}
                    </Text>
                    <View className="flex-row items-center gap-4">
                      {project.genre && (
                        <View className="flex-row items-center gap-1">
                          <Tag size={12} color="#52525b" />
                          <Text className="text-xs text-mythos-text-muted uppercase">
                            {project.genre}
                          </Text>
                        </View>
                      )}
                      <View className="flex-row items-center gap-1">
                        <Clock size={12} color="#52525b" />
                        <Text className="text-xs text-mythos-text-muted">
                          {formatRelativeTime(project.updated_at)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
