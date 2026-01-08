import { useState, useCallback } from 'react';

export interface EditorDocument {
  id: string;
  title: string;
  content: string;
  isDirty: boolean;
  createdAt: number;
  updatedAt: number;
}

interface UseEditorStateOptions {
  initialDocuments?: EditorDocument[];
  onSave?: (doc: EditorDocument) => Promise<void>;
}

export function useEditorState({ initialDocuments = [], onSave }: UseEditorStateOptions = {}) {
  const [documents, setDocuments] = useState<EditorDocument[]>(
    initialDocuments.length > 0
      ? initialDocuments
      : [createDocument()]
  );
  const [activeDocId, setActiveDocId] = useState<string>(documents[0]?.id ?? '');

  const activeDocument = documents.find((d) => d.id === activeDocId) ?? null;

  const createDocument = useCallback((): EditorDocument => {
    const now = Date.now();
    return {
      id: `doc-${now}`,
      title: 'Untitled',
      content: '',
      isDirty: false,
      createdAt: now,
      updatedAt: now,
    };
  }, []);

  const addDocument = useCallback((doc?: Partial<EditorDocument>) => {
    const newDoc = { ...createDocument(), ...doc };
    setDocuments((prev) => [...prev, newDoc]);
    setActiveDocId(newDoc.id);
    return newDoc;
  }, [createDocument]);

  const updateDocument = useCallback((id: string, updates: Partial<EditorDocument>) => {
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === id
          ? { ...doc, ...updates, updatedAt: Date.now(), isDirty: true }
          : doc
      )
    );
  }, []);

  const deleteDocument = useCallback((id: string) => {
    setDocuments((prev) => {
      const newDocs = prev.filter((d) => d.id !== id);
      if (newDocs.length === 0) {
        const newDoc = createDocument();
        setActiveDocId(newDoc.id);
        return [newDoc];
      }
      if (activeDocId === id) {
        setActiveDocId(newDocs[0].id);
      }
      return newDocs;
    });
  }, [activeDocId, createDocument]);

  const saveDocument = useCallback(async (id: string) => {
    const doc = documents.find((d) => d.id === id);
    if (!doc || !onSave) return;

    await onSave(doc);
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, isDirty: false } : d
      )
    );
  }, [documents, onSave]);

  const saveActiveDocument = useCallback(async () => {
    if (activeDocId) {
      await saveDocument(activeDocId);
    }
  }, [activeDocId, saveDocument]);

  return {
    documents,
    activeDocId,
    activeDocument,
    setActiveDocId,
    addDocument,
    updateDocument,
    deleteDocument,
    saveDocument,
    saveActiveDocument,
  };
}

function createDocument(): EditorDocument {
  const now = Date.now();
  return {
    id: `doc-${now}`,
    title: 'Untitled',
    content: '',
    isDirty: false,
    createdAt: now,
    updatedAt: now,
  };
}
