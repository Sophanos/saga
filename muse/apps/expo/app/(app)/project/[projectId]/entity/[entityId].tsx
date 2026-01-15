import { useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "../../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../../convex/_generated/dataModel";
import { useTheme, typography } from "@/design-system";
import { useProjectStore } from "@mythos/state";

type DeepLinkAccess =
  | { allowed: true }
  | { allowed: false; reason: "unauthenticated" | "not_member" | "not_editor" | "not_found" };

function LoadingView(): JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: colors.bgApp }]}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

function AccessDeniedView({ reason }: { reason: string }): JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: colors.bgApp }]}>
      <Text style={[styles.title, { color: colors.text }]}>Access denied</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        {reason}
      </Text>
    </View>
  );
}

export default function EntityDeepLinkScreen(): JSX.Element {
  const router = useRouter();
  const { projectId, entityId } = useLocalSearchParams<{
    projectId: string;
    entityId: string;
  }>();

  const setCurrentProjectId = useProjectStore((s) => s.setCurrentProjectId);

  const access = useQuery(
    (api as any).deepLinks.checkAccess,
    projectId && entityId
      ? {
          projectId: projectId as Id<"projects">,
          targetType: "entity",
          targetId: entityId,
          requireRole: "member",
        }
      : "skip"
  ) as DeepLinkAccess | undefined;

  useEffect(() => {
    if (!projectId) return;
    if (!access?.allowed) return;
    setCurrentProjectId(projectId);
    router.replace("/project-graph");
  }, [access, projectId, router, setCurrentProjectId]);

  if (!projectId || !entityId) {
    return <AccessDeniedView reason="not_found" />;
  }

  if (!access) {
    return <LoadingView />;
  }

  if (!access.allowed) {
    return <AccessDeniedView reason={access.reason} />;
  }

  return <LoadingView />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: typography.lg,
    fontWeight: "600",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: typography.sm,
    textAlign: "center",
  },
});

