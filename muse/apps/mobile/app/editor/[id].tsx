import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  FileText,
  ChevronRight,
  AlertCircle,
  Plus,
  BookOpen,
  Settings,
  Users,
} from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useEffect, useState, useCallback, useMemo } from "react";
import { formatRelativeTime } from "@mythos/core";
import { getMobileSupabase, type Database } from "../../lib/supabase";
import { useSupabaseAuthSync } from "../../lib/useSupabaseAuthSync";

// ============================================
// EDITOR SCREEN
// ============================================

type Project = Database["public"]["Tables"]["projects"]["Row"];
type Document = Database["public"]["Tables"]["documents"]["Row"];

/**
 * Calculate word count from document content
 */
function getWordCount(content: unknown): number {
  if (!content) return 0;
  
  // Handle Tiptap JSON content
  if (typeof content === "object") {
    const extractText = (node: unknown): string => {
      if (!node || typeof node !== "object") return "";
      const n = node as Record<string, unknown>;
      if (n.type === "text" && typeof n.text === "string") return n.text;
      if (Array.isArray(n.content)) {
        return n.content.map(extractText).join(" ");
      }
      return "";
    };
    const text = extractText(content);
    return text.split(/\s+/).filter(Boolean).length;
  }
  
  // Handle plain text
  if (typeof content === "string") {
    return content.split(/\s+/).filter(Boolean).length;
  }
  
  return 0;
}

export default function EditorScreen() {
  const { user } = useSupabaseAuthSync();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const fetchProjectData = useCallback(async () => {
    if (!user || !id) return;

    try {
      setIsLoading(true);
      setError(null);

      const supabase = getMobileSupabase();

      // Fetch project details
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();

      if (projectError) {
        if (projectError.code === "PGRST116") {
          throw new Error("Project not found");
        }
        throw new Error(projectError.message);
      }

      setProject(projectData);

      // Fetch documents for the project
      const { data: docsData, error: docsError } = await supabase
        .from("documents")
        .select("*")
        .eq("project_id", id)
        .order("order_index");

      if (docsError) {
        throw new Error(docsError.message);
      }

      const docs = (docsData || []) as Document[];
      setDocuments(docs);

      // Select first document by default if available
      if (docs.length > 0 && !selectedDocId) {
        setSelectedDocId(docs[0].id);
      }
    } catch (err) {
      console.error("[Editor] Error fetching project data:", err);
      setError(err instanceof Error ? err.message : "Failed to load project");
    } finally {
      setIsLoading(false);
    }
  }, [user, id, selectedDocId]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  // Get the selected document
  const selectedDocument = useMemo(() => {
    return documents.find((d) => d.id === selectedDocId) || null;
  }, [documents, selectedDocId]);

  // Calculate total word count
  const totalWordCount = useMemo(() => {
    return documents.reduce((sum, doc) => sum + getWordCount(doc.content), 0);
  }, [documents]);

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
            Loading...
          </Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#22d3ee" />
          <Text className="text-sm text-mythos-text-muted mt-3">Loading project...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !project) {
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
            Editor
          </Text>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-14 h-14 rounded-2xl bg-mythos-accent-red/20 items-center justify-center mb-4">
            <AlertCircle size={28} color="#f87171" />
          </View>
          <Text className="text-base font-medium text-mythos-text-primary mb-2">
            {error || "Project not found"}
          </Text>
          <Text className="text-sm text-mythos-text-muted text-center mb-6">
            Unable to load the project
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="px-6 py-3 rounded-xl bg-mythos-accent-cyan"
          >
            <Text className="text-sm font-medium text-mythos-bg-primary">Go Back</Text>
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
            <Text className="text-lg font-semibold text-mythos-text-primary" numberOfLines={1}>
              {project.name}
            </Text>
            <Text className="text-xs text-mythos-text-muted">
              {documents.length} {documents.length === 1 ? "chapter" : "chapters"} | {totalWordCount.toLocaleString()} words
            </Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => router.push(`/world?projectId=${project.id}`)}
            className="w-10 h-10 rounded-xl bg-mythos-bg-secondary items-center justify-center"
          >
            <Users size={18} color="#a1a1aa" />
          </Pressable>
          <Pressable className="w-10 h-10 rounded-xl bg-mythos-bg-secondary items-center justify-center">
            <Settings size={18} color="#a1a1aa" />
          </Pressable>
        </View>
      </View>

      {/* Project Info */}
      {project.description && (
        <View className="px-6 py-3 border-b border-mythos-border-subtle">
          <Text className="text-sm text-mythos-text-muted" numberOfLines={2}>
            {project.description}
          </Text>
        </View>
      )}

      {/* Document List / Content Area */}
      <View className="flex-1 flex-row">
        {/* Sidebar - Document List */}
        <View className="w-1/3 border-r border-mythos-border-subtle">
          <View className="flex-row items-center justify-between px-4 py-3">
            <Text className="text-xs font-medium text-mythos-text-muted uppercase tracking-wide">
              Chapters
            </Text>
            <Pressable className="w-7 h-7 rounded-lg bg-mythos-bg-secondary items-center justify-center">
              <Plus size={14} color="#a1a1aa" />
            </Pressable>
          </View>
          <ScrollView className="flex-1">
            {documents.length === 0 ? (
              <View className="px-4 py-8">
                <Text className="text-xs text-mythos-text-muted text-center">
                  No chapters yet
                </Text>
              </View>
            ) : (
              documents.map((doc, index) => (
                <Animated.View
                  key={doc.id}
                  entering={FadeInDown.delay(index * 50).duration(300)}
                >
                  <Pressable
                    onPress={() => setSelectedDocId(doc.id)}
                    className={`px-4 py-3 border-b border-mythos-border-subtle ${
                      selectedDocId === doc.id
                        ? "bg-mythos-accent-cyan/10 border-l-2 border-l-mythos-accent-cyan"
                        : ""
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium mb-1 ${
                        selectedDocId === doc.id
                          ? "text-mythos-accent-cyan"
                          : "text-mythos-text-primary"
                      }`}
                      numberOfLines={1}
                    >
                      {doc.title || `Chapter ${index + 1}`}
                    </Text>
                    <Text className="text-xs text-mythos-text-muted">
                      {getWordCount(doc.content).toLocaleString()} words
                    </Text>
                  </Pressable>
                </Animated.View>
              ))
            )}
          </ScrollView>
        </View>

        {/* Main Content Area */}
        <View className="flex-1">
          {selectedDocument ? (
            <ScrollView className="flex-1 px-4 py-4">
              <Text className="text-lg font-semibold text-mythos-text-primary mb-2">
                {selectedDocument.title || "Untitled"}
              </Text>
              <Text className="text-xs text-mythos-text-muted mb-4">
                Last edited {formatRelativeTime(selectedDocument.updated_at)}
              </Text>
              
              {/* Document Content Preview */}
              <View className="bg-mythos-bg-secondary rounded-xl p-4 border border-mythos-border-subtle">
                <DocumentContentPreview content={selectedDocument.content} />
              </View>
              
              {/* Edit Button */}
              <Pressable className="mt-4 flex-row items-center justify-center gap-2 py-3 rounded-xl bg-mythos-accent-cyan">
                <FileText size={18} color="#07070a" />
                <Text className="text-sm font-medium text-mythos-bg-primary">
                  Open Editor
                </Text>
              </Pressable>
            </ScrollView>
          ) : (
            <View className="flex-1 items-center justify-center px-4">
              <View className="w-14 h-14 rounded-2xl bg-mythos-bg-secondary items-center justify-center mb-4">
                <BookOpen size={28} color="#52525b" />
              </View>
              <Text className="text-sm font-medium text-mythos-text-primary mb-1">
                Select a chapter
              </Text>
              <Text className="text-xs text-mythos-text-muted text-center">
                Choose a chapter from the sidebar to view and edit
              </Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

/**
 * Document content preview component
 */
function DocumentContentPreview({ content }: { content: unknown }) {
  // Extract plain text from Tiptap JSON content
  const extractText = (node: unknown): string => {
    if (!node || typeof node !== "object") return "";
    const n = node as Record<string, unknown>;
    if (n.type === "text" && typeof n.text === "string") return n.text;
    if (Array.isArray(n.content)) {
      return n.content.map(extractText).join(" ");
    }
    return "";
  };

  let previewText = "";
  
  if (typeof content === "object" && content !== null) {
    previewText = extractText(content);
  } else if (typeof content === "string") {
    previewText = content;
  }

  // Limit preview length
  const maxLength = 500;
  const truncated = previewText.length > maxLength;
  const displayText = truncated ? previewText.slice(0, maxLength) + "..." : previewText;

  if (!displayText) {
    return (
      <Text className="text-sm text-mythos-text-muted italic">
        No content yet. Tap "Open Editor" to start writing.
      </Text>
    );
  }

  return (
    <Text className="text-sm text-mythos-text-secondary leading-relaxed">
      {displayText}
    </Text>
  );
}
