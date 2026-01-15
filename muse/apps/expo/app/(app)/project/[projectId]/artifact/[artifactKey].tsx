import { useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "../../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../../convex/_generated/dataModel";
import { useTheme, typography } from "@/design-system";
import { ArtifactPanel } from "@/components/artifacts/ArtifactPanel";
import { useArtifactStore, useProjectStore } from "@mythos/state";

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

export default function ArtifactDeepLinkScreen(): JSX.Element {
  const { colors } = useTheme();
  const { projectId, artifactKey } = useLocalSearchParams<{
    projectId: string;
    artifactKey: string;
  }>();

  const setCurrentProjectId = useProjectStore((s) => s.setCurrentProjectId);
  const setActiveArtifact = useArtifactStore((s) => s.setActiveArtifact);

  const access = useQuery(
    (api as any).deepLinks.checkAccess,
    projectId && artifactKey
      ? {
          projectId: projectId as Id<"projects">,
          targetType: "artifact",
          targetId: artifactKey,
          requireRole: "member",
        }
      : "skip"
  ) as DeepLinkAccess | undefined;

  useEffect(() => {
    if (!projectId) return;
    if (!access?.allowed) return;
    setCurrentProjectId(projectId);
  }, [access, projectId, setCurrentProjectId]);

  useEffect(() => {
    if (!artifactKey) return;
    if (!access?.allowed) return;
    setActiveArtifact(artifactKey);
  }, [access, artifactKey, setActiveArtifact]);

  if (!projectId || !artifactKey) {
    return <AccessDeniedView reason="not_found" />;
  }

  if (!access) {
    return <LoadingView />;
  }

  if (!access.allowed) {
    return <AccessDeniedView reason={access.reason} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
      <ArtifactPanel flowMode />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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

