import { useEffect } from "react";
import { useAnonymousStore } from "../../stores/anonymous";
import { useMythosStore } from "../../stores";
import { embedManyViaEdge } from "../../services/ai";
import { tiptapDocToBlocks } from "../../services/export/tiptap/tiptapToIr";
import { blocksToText } from "../../services/export/ir";
import type { Document } from "@mythos/core";

const EMBEDDINGS_ENABLED = import.meta.env["VITE_EMBEDDINGS_ENABLED"] !== "false";

function createOutlineContent(titles: string[]): unknown {
  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "Outline" }],
      },
      {
        type: "bulletList",
        content: titles.map((title) => ({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: title }],
            },
          ],
        })),
      },
    ],
  };
}

function getDocumentText(doc: Document): string {
  try {
    const blocks = tiptapDocToBlocks(doc.content);
    return blocksToText(blocks).trim();
  } catch (error) {
    console.warn("[TryBootstrapController] Failed to extract text:", error);
    return "";
  }
}

export function TryBootstrapController() {
  const project = useMythosStore((s) => s.project.currentProject);
  const documents = useMythosStore((s) => s.document.documents);
  const importedDocumentIds = useAnonymousStore((s) => s.importedDocumentIds);
  const hasRunTryBootstrap = useAnonymousStore((s) => s.hasRunTryBootstrap);
  const markTryBootstrapRun = useAnonymousStore((s) => s.markTryBootstrapRun);
  const addDocument = useAnonymousStore((s) => s.addDocument);
  const sessionId = useAnonymousStore((s) => s.sessionId);

  useEffect(() => {
    if (!project || hasRunTryBootstrap) return;

    const importedDocs = (importedDocumentIds.length > 0
      ? documents.filter((doc) => importedDocumentIds.includes(doc.id))
      : documents
    ).filter((doc) => doc.title !== "Welcome / Quick Start");

    if (importedDocs.length === 0) return;

    markTryBootstrapRun();

    const outlineExists = documents.some((doc) => doc.type === "outline");
    if (!outlineExists) {
      const titles = importedDocs.map((doc) => doc.title ?? "Untitled");
      addDocument({
        projectId: project.id,
        title: "Outline",
        content: createOutlineContent(titles),
        type: "outline",
      });
    }

    if (!EMBEDDINGS_ENABLED) return;

    const texts: string[] = [];
    const points: Array<{ id: string; payload: Record<string, unknown> }> = [];
    const namespace = sessionId ? `anon:${sessionId}` : `anon:${project.id}`;

    importedDocs.forEach((doc) => {
      const text = getDocumentText(doc);
      if (!text) return;
      texts.push(text);
      points.push({
        id: `try_doc_${doc.id}`,
        payload: {
          namespace,
          project_id: project.id,
          doc_id: doc.id,
          title: doc.title ?? "Untitled",
          kind: "document",
          source: "try",
        },
      });
    });

    if (texts.length === 0) return;

    void embedManyViaEdge(texts, {
      qdrant: {
        enabled: true,
        points,
      },
    }).catch((error) => {
      console.warn("[TryBootstrapController] Qdrant indexing failed:", error);
    });
  }, [
    project,
    documents,
    importedDocumentIds,
    hasRunTryBootstrap,
    markTryBootstrapRun,
    addDocument,
    sessionId,
  ]);

  return null;
}
