import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useTheme, spacing, typography, radii } from "@/design-system";
import { useProjectStore } from "@mythos/state";
import type { Project } from "@mythos/core";

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

export default function E2EScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const isEnabled = useMemo(
    () => __DEV__ || process.env.EXPO_PUBLIC_E2E === "true",
    []
  );

  const [projectName, setProjectName] = useState("E2E/Local/Project");
  const [documentTitle, setDocumentTitle] = useState("E2E Document");
  const [documentType, setDocumentType] = useState("chapter");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const setProject = useProjectStore((s) => s.setProject);
  const setCurrentDocumentId = useProjectStore((s) => s.setCurrentDocumentId);

  // Convex API types are too deep for expo typecheck; treat as untyped.
  // @ts-ignore
  const apiAny: any = api;
  const createProject = useMutation(apiAny.projects.create as any);
  const createDocument = useMutation(apiAny.documents.create as any);

  const handleCreateProject = async () => {
    setStatus(null);
    try {
      const id = await createProject({ name: projectName });
      setProjectId(id);

      const now = new Date();
      const project: Project = {
        id,
        name: projectName,
        description: undefined,
        templateId: undefined,
        templateOverrides: undefined,
        config: {},
        createdAt: now,
        updatedAt: now,
      };

      setProject(project);
      setStatus("Project created");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create project");
    }
  };

  const handleCreateDocument = async () => {
    if (!projectId) {
      setStatus("Create a project first");
      return;
    }

    setStatus(null);
    try {
      const id = await createDocument({
        projectId,
        type: documentType,
        title: documentTitle,
        content: EMPTY_DOC,
        contentText: "",
      });

      setDocumentId(id);
      setCurrentDocumentId(id);
      setStatus("Document created");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create document");
    }
  };

  const handleOpenEditor = () => {
    router.push("/editor");
  };

  if (!isEnabled) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgApp }]}> 
        <Text style={[styles.title, { color: colors.text }]}>E2E harness disabled</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>Enable EXPO_PUBLIC_E2E or run in dev mode.</Text>
        <Pressable
          onPress={() => router.replace("/")}
          style={[styles.button, { backgroundColor: colors.accent }]}
        >
          <Text style={styles.buttonText}>Back to Home</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgApp }]}> 
      <Text style={[styles.title, { color: colors.text }]}>E2E Tools</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Create seeded data for Playwright.</Text>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>PROJECT</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bgSurface }]}
          placeholder="Project name"
          placeholderTextColor={colors.textMuted}
          value={projectName}
          onChangeText={setProjectName}
          autoCapitalize="words"
          testID="e2e-project-name"
        />
        <Pressable
          onPress={handleCreateProject}
          style={[styles.button, { backgroundColor: colors.accent }]}
          testID="e2e-create-project"
        >
          <Text style={styles.buttonText}>Create Project</Text>
        </Pressable>
        {projectId && (
          <Text style={[styles.meta, { color: colors.textMuted }]} testID="e2e-project-id">
            Project ID: {projectId}
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>DOCUMENT</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bgSurface }]}
          placeholder="Document title"
          placeholderTextColor={colors.textMuted}
          value={documentTitle}
          onChangeText={setDocumentTitle}
          testID="e2e-document-title"
        />
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bgSurface }]}
          placeholder="Document type (chapter, scene, note)"
          placeholderTextColor={colors.textMuted}
          value={documentType}
          onChangeText={setDocumentType}
          autoCapitalize="none"
          testID="e2e-document-type"
        />
        <Pressable
          onPress={handleCreateDocument}
          style={[styles.button, { backgroundColor: colors.accent }]}
          testID="e2e-create-document"
        >
          <Text style={styles.buttonText}>Create Document</Text>
        </Pressable>
        {documentId && (
          <Text style={[styles.meta, { color: colors.textMuted }]} testID="e2e-document-id">
            Document ID: {documentId}
          </Text>
        )}
      </View>

      <Pressable
        onPress={handleOpenEditor}
        style={[styles.button, styles.secondaryButton, { borderColor: colors.border }]}
        testID="e2e-open-editor"
      >
        <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Open Editor</Text>
      </Pressable>

      {status && (
        <Text style={[styles.meta, { color: colors.textMuted }]} testID="e2e-status">
          {status}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing[6],
    gap: spacing[5],
  },
  title: {
    fontSize: typography["2xl"],
    fontWeight: "700",
  },
  subtitle: {
    fontSize: typography.base,
  },
  section: {
    gap: spacing[3],
  },
  sectionTitle: {
    fontSize: typography.xs,
    letterSpacing: 0.5,
    fontWeight: typography.semibold,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing[3],
    fontSize: typography.base,
  },
  button: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: typography.base,
    fontWeight: typography.semibold,
  },
  secondaryButton: {
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  secondaryButtonText: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
  },
  meta: {
    fontSize: typography.sm,
  },
});
