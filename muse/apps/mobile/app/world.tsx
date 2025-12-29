import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft, User, MapPin, Sword, Sparkles } from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

// ============================================
// WORLD GRAPH SCREEN
// ============================================

const ENTITY_TYPES = [
  { type: "character", icon: User, label: "Characters", count: 12, color: "#22d3ee" },
  { type: "location", icon: MapPin, label: "Locations", count: 8, color: "#a855f7" },
  { type: "item", icon: Sword, label: "Items", count: 5, color: "#fbbf24" },
  { type: "magic", icon: Sparkles, label: "Magic Systems", count: 2, color: "#4ade80" },
];

const RECENT_ENTITIES = [
  { id: "1", name: "Aria Blackwood", type: "character", mentions: 47 },
  { id: "2", name: "The Iron Citadel", type: "location", mentions: 23 },
  { id: "3", name: "Marcus Vane", type: "character", mentions: 31 },
  { id: "4", name: "Shadowbane Blade", type: "item", mentions: 12 },
];

export default function WorldScreen() {
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
            World Graph
          </Text>
          <Text className="text-xs text-mythos-text-muted">
            27 entities tracked
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1">
        {/* Entity Type Cards */}
        <View className="px-6 py-4">
          <Text className="text-sm font-medium text-mythos-text-muted mb-3 uppercase tracking-wide">
            Entity Types
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {ENTITY_TYPES.map((entity, index) => (
              <Animated.View
                key={entity.type}
                entering={FadeInDown.delay(index * 50).duration(400)}
                className="flex-1 min-w-[45%]"
              >
                <Pressable
                  className="bg-mythos-bg-secondary rounded-2xl p-4 border border-mythos-border-subtle"
                  onPress={() => router.push(`/world/${entity.type}`)}
                >
                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center mb-3"
                    style={{ backgroundColor: `${entity.color}20` }}
                  >
                    <entity.icon size={20} color={entity.color} />
                  </View>
                  <Text className="text-base font-semibold text-mythos-text-primary">
                    {entity.label}
                  </Text>
                  <Text className="text-sm text-mythos-text-muted">
                    {entity.count} tracked
                  </Text>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </View>

        {/* Recent Entities */}
        <View className="px-6 py-4">
          <Text className="text-sm font-medium text-mythos-text-muted mb-3 uppercase tracking-wide">
            Recently Mentioned
          </Text>
          {RECENT_ENTITIES.map((entity, index) => (
            <Animated.View
              key={entity.id}
              entering={FadeInDown.delay(200 + index * 50).duration(400)}
            >
              <Pressable className="flex-row items-center justify-between bg-mythos-bg-secondary rounded-xl p-4 mb-2 border border-mythos-border-subtle">
                <View className="flex-row items-center gap-3">
                  <View
                    className="w-8 h-8 rounded-lg items-center justify-center"
                    style={{
                      backgroundColor:
                        entity.type === "character"
                          ? "#22d3ee20"
                          : entity.type === "location"
                          ? "#a855f720"
                          : "#fbbf2420",
                    }}
                  >
                    {entity.type === "character" && (
                      <User
                        size={16}
                        color="#22d3ee"
                      />
                    )}
                    {entity.type === "location" && (
                      <MapPin
                        size={16}
                        color="#a855f7"
                      />
                    )}
                    {entity.type === "item" && (
                      <Sword
                        size={16}
                        color="#fbbf24"
                      />
                    )}
                  </View>
                  <View>
                    <Text className="text-sm font-medium text-mythos-text-primary">
                      {entity.name}
                    </Text>
                    <Text className="text-xs text-mythos-text-muted capitalize">
                      {entity.type}
                    </Text>
                  </View>
                </View>
                <Text className="text-xs text-mythos-text-muted">
                  {entity.mentions} mentions
                </Text>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
