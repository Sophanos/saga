import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { ArrowLeft, User, MapPin, Sword, Sparkles, Users, AlertCircle } from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useEffect, useState, useCallback, useMemo } from "react";
import { getMobileSupabase, type Database } from "../lib/supabase";
import { useSupabaseAuthSync } from "../lib/useSupabaseAuthSync";
import type { LucideIcon } from "lucide-react-native";

// ============================================
// PROJECT GRAPH SCREEN
// ============================================

type Entity = Database["public"]["Tables"]["entities"]["Row"];

/**
 * Entity type configuration with icons and colors
 */
const ENTITY_TYPE_CONFIG: Record<string, { icon: LucideIcon; label: string; color: string }> = {
  character: { icon: User, label: "Characters", color: "#22d3ee" },
  location: { icon: MapPin, label: "Locations", color: "#a855f7" },
  item: { icon: Sword, label: "Items", color: "#fbbf24" },
  magic_system: { icon: Sparkles, label: "Magic Systems", color: "#4ade80" },
  faction: { icon: Users, label: "Factions", color: "#f472b6" },
};

/**
 * Get entity type configuration with fallback
 */
function getEntityConfig(type: string) {
  return ENTITY_TYPE_CONFIG[type] || { icon: User, label: type, color: "#71717a" };
}

export default function WorldScreen() {
  const { user } = useSupabaseAuthSync();
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();

  const [entities, setEntities] = useState<Entity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);

  const fetchEntities = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);

      const supabase = getMobileSupabase();

      if (projectId) {
        // Fetch entities for a specific project
        const { data: project } = await supabase
          .from("projects")
          .select("name")
          .eq("id", projectId)
          .single();

        setProjectName((project as { name: string } | null)?.name || null);

        const { data, error: entitiesError } = await supabase
          .from("entities")
          .select("*")
          .eq("project_id", projectId)
          .order("updated_at", { ascending: false });

        if (entitiesError) {
          throw new Error(entitiesError.message);
        }

        setEntities(data || []);
      } else {
        // Fetch entities from all user's projects
        // First get user's project IDs
        const { data: projects } = await supabase
          .from("projects")
          .select("id")
          .eq("user_id", user.id);

        const projectIds = (projects as { id: string }[] | null)?.map((p) => p.id) || [];

        if (projectIds.length === 0) {
          setEntities([]);
          return;
        }

        const { data, error: entitiesError } = await supabase
          .from("entities")
          .select("*")
          .in("project_id", projectIds)
          .order("updated_at", { ascending: false });

        if (entitiesError) {
          throw new Error(entitiesError.message);
        }

        setEntities(data || []);
      }
    } catch (err) {
      console.error("[World] Error fetching entities:", err);
      setError(err instanceof Error ? err.message : "Failed to load entities");
    } finally {
      setIsLoading(false);
    }
  }, [user, projectId]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  // Calculate entity type counts
  const entityTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entity of entities) {
      counts[entity.type] = (counts[entity.type] || 0) + 1;
    }
    return counts;
  }, [entities]);

  // Get entity types with counts (only show types that have entities or are common)
  const entityTypes = useMemo(() => {
    const types = Object.keys(ENTITY_TYPE_CONFIG);
    return types
      .map((type) => ({
        type,
        ...ENTITY_TYPE_CONFIG[type],
        count: entityTypeCounts[type] || 0,
      }))
      .filter((t) => t.count > 0 || ["character", "location", "item"].includes(t.type));
  }, [entityTypeCounts]);

  // Get recent entities (last 10 updated)
  const recentEntities = useMemo(() => {
    return entities.slice(0, 10);
  }, [entities]);

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
            Project Graph
          </Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#22d3ee" />
          <Text className="text-sm text-mythos-text-muted mt-3">Loading entities...</Text>
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
            Project Graph
          </Text>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-14 h-14 rounded-2xl bg-mythos-accent-red/20 items-center justify-center mb-4">
            <AlertCircle size={28} color="#f87171" />
          </View>
          <Text className="text-base font-medium text-mythos-text-primary mb-2">
            Failed to load entities
          </Text>
          <Text className="text-sm text-mythos-text-muted text-center mb-6">
            {error}
          </Text>
          <Pressable
            onPress={fetchEntities}
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
      <View className="flex-row items-center gap-3 px-6 py-4 border-b border-mythos-border-subtle">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-xl bg-mythos-bg-secondary items-center justify-center"
        >
          <ArrowLeft size={20} color="#a1a1aa" />
        </Pressable>
        <View>
          <Text className="text-lg font-semibold text-mythos-text-primary">
            Project Graph
          </Text>
          <Text className="text-xs text-mythos-text-muted">
            {projectName ? projectName : `${entities.length} entities tracked`}
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1">
        {entities.length === 0 ? (
          <View className="items-center justify-center py-16 px-6">
            <View className="w-16 h-16 rounded-2xl bg-mythos-bg-secondary items-center justify-center mb-4">
              <User size={32} color="#52525b" />
            </View>
            <Text className="text-base font-medium text-mythos-text-primary mb-2">
              No entities yet
            </Text>
            <Text className="text-sm text-mythos-text-muted text-center">
              Start writing and entities will be detected automatically
            </Text>
          </View>
        ) : (
          <>
            {/* Entity Type Cards */}
            <View className="px-6 py-4">
              <Text className="text-sm font-medium text-mythos-text-muted mb-3 uppercase tracking-wide">
                Entity Types
              </Text>
              <View className="flex-row flex-wrap gap-3">
                {entityTypes.map((entityType, index) => {
                  const Icon = entityType.icon;
                  return (
                    <Animated.View
                      key={entityType.type}
                      entering={FadeInDown.delay(index * 50).duration(400)}
                      className="flex-1 min-w-[45%]"
                    >
                      <Pressable
                        className="bg-mythos-bg-secondary rounded-2xl p-4 border border-mythos-border-subtle"
                        onPress={() => router.push(`/world/${entityType.type}${projectId ? `?projectId=${projectId}` : ""}` as Href)}
                      >
                        <View
                          className="w-10 h-10 rounded-xl items-center justify-center mb-3"
                          style={{ backgroundColor: `${entityType.color}20` }}
                        >
                          <Icon size={20} color={entityType.color} />
                        </View>
                        <Text className="text-base font-semibold text-mythos-text-primary">
                          {entityType.label}
                        </Text>
                        <Text className="text-sm text-mythos-text-muted">
                          {entityType.count} tracked
                        </Text>
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </View>
            </View>

            {/* Recent Entities */}
            {recentEntities.length > 0 && (
              <View className="px-6 py-4">
                <Text className="text-sm font-medium text-mythos-text-muted mb-3 uppercase tracking-wide">
                  Recently Updated
                </Text>
                {recentEntities.map((entity, index) => {
                  const config = getEntityConfig(entity.type);
                  const Icon = config.icon;
                  return (
                    <Animated.View
                      key={entity.id}
                      entering={FadeInDown.delay(200 + index * 50).duration(400)}
                    >
                      <Pressable className="flex-row items-center justify-between bg-mythos-bg-secondary rounded-xl p-4 mb-2 border border-mythos-border-subtle">
                        <View className="flex-row items-center gap-3">
                          <View
                            className="w-8 h-8 rounded-lg items-center justify-center"
                            style={{ backgroundColor: `${config.color}20` }}
                          >
                            <Icon size={16} color={config.color} />
                          </View>
                          <View>
                            <Text className="text-sm font-medium text-mythos-text-primary">
                              {entity.name}
                            </Text>
                            <Text className="text-xs text-mythos-text-muted capitalize">
                              {entity.type.replace("_", " ")}
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
