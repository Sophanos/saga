/**
 * useCapture - Hook for creating captures from mobile
 *
 * Provides functions to create different types of captures:
 * - Text notes
 * - Voice memos
 * - Photos
 * - Flagged passages
 *
 * Uses the sync engine for offline-first persistence and
 * the progressive store for local state management.
 */

import { useState, useCallback } from "react";
import * as Crypto from "expo-crypto";
import {
  useProgressiveStore,
  useProjectStore,
  type CaptureKind,
  type CaptureRecord,
} from "@mythos/state";
import { useSupabaseAuthSync } from "../lib/useSupabaseAuthSync";
import { getMobileSupabase } from "../lib/supabase";

/**
 * Input for creating a text capture
 */
export interface TextCaptureInput {
  title?: string;
  content: string;
}

/**
 * Input for creating a voice capture
 */
export interface VoiceCaptureInput {
  title?: string;
  localUri: string;
  mimeType: string;
  durationMs?: number;
}

/**
 * Input for creating a photo capture
 */
export interface PhotoCaptureInput {
  title?: string;
  localUri: string;
  mimeType: string;
  width?: number;
  height?: number;
}

/**
 * Input for creating a flag capture
 */
export interface FlagCaptureInput {
  documentId: string;
  excerpt: string;
  note?: string;
}

/**
 * Return type for the useCapture hook
 */
export interface UseCapture {
  /**
   * Create a text note capture
   * @returns The ID of the created capture
   */
  createTextCapture: (input: TextCaptureInput) => Promise<string>;

  /**
   * Create a voice memo capture
   * @returns The ID of the created capture
   */
  createVoiceCapture: (input: VoiceCaptureInput) => Promise<string>;

  /**
   * Create a photo capture
   * @returns The ID of the created capture
   */
  createPhotoCapture: (input: PhotoCaptureInput) => Promise<string>;

  /**
   * Create a flagged passage capture
   * @returns The ID of the created capture
   */
  createFlagCapture: (input: FlagCaptureInput) => Promise<string>;

  /**
   * Whether a capture is currently being created
   */
  isCreating: boolean;

  /**
   * Error message if capture creation failed
   */
  error: string | null;

  /**
   * Clear the error state
   */
  clearError: () => void;
}

/**
 * Generate a UUID v4
 */
async function generateUUID(): Promise<string> {
  return await Crypto.randomUUID();
}

/**
 * Hook for creating captures from mobile.
 *
 * @example
 * ```tsx
 * function CaptureScreen() {
 *   const { createTextCapture, isCreating, error } = useCapture();
 *
 *   const handleSubmit = async (content: string) => {
 *     try {
 *       const id = await createTextCapture({ content });
 *       console.log("Created capture:", id);
 *     } catch (err) {
 *       console.error("Failed to create capture:", err);
 *     }
 *   };
 *
 *   return <TextInput onSubmit={handleSubmit} disabled={isCreating} />;
 * }
 * ```
 */
export function useCapture(): UseCapture {
  const { user } = useSupabaseAuthSync();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get current project ID from store
  const currentProjectId = useProjectStore((s) => s.currentProjectId);

  // Get the addCapture action from progressive store
  const addCapture = useProgressiveStore((s) => s.addCapture);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Create a capture record and save it
   */
  const createCapture = useCallback(
    async (
      kind: CaptureKind,
      data: {
        title?: string;
        content?: string;
        mediaUrl?: string;
        mediaMimeType?: string;
        payload?: Record<string, unknown>;
      }
    ): Promise<string> => {
      if (!user) {
        throw new Error("User not authenticated");
      }

      if (!currentProjectId) {
        throw new Error("No project selected");
      }

      setIsCreating(true);
      setError(null);

      try {
        const id = await generateUUID();
        const now = new Date().toISOString();

        // Create the capture record
        const capture: CaptureRecord = {
          id,
          projectId: currentProjectId,
          createdBy: user.id,
          kind,
          status: "inbox",
          title: data.title,
          content: data.content,
          mediaUrl: data.mediaUrl,
          mediaMimeType: data.mediaMimeType,
          payload: data.payload || {},
          source: "mobile",
          createdAt: now,
          updatedAt: now,
        };

        // Add to progressive store (optimistic update)
        addCapture(capture);

        // Persist to Supabase
        // Note: Using type cast since captures table types may not be regenerated yet
        const supabase = getMobileSupabase();
        const captureRow = {
          id: capture.id,
          project_id: capture.projectId,
          created_by: capture.createdBy,
          kind: capture.kind,
          status: capture.status,
          title: capture.title,
          content: capture.content,
          media_url: capture.mediaUrl,
          media_mime_type: capture.mediaMimeType,
          payload: capture.payload,
          source: capture.source,
          created_at: capture.createdAt,
          updated_at: capture.updatedAt,
        };

        const { error: insertError } = await supabase
          .from("captures")
          .insert(captureRow as never);

        if (insertError) {
          // If insert fails, we still have the optimistic update
          // The sync engine will handle retry later
          console.warn("[Capture] Insert failed, will retry:", insertError.message);
          // For now, we don't throw - the capture is saved locally
        }

        return id;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create capture";
        setError(message);
        throw err;
      } finally {
        setIsCreating(false);
      }
    },
    [user, currentProjectId, addCapture]
  );

  /**
   * Create a text note capture
   */
  const createTextCapture = useCallback(
    async (input: TextCaptureInput): Promise<string> => {
      if (!input.content.trim()) {
        throw new Error("Content is required");
      }

      return createCapture("text", {
        title: input.title,
        content: input.content,
        payload: {
          charCount: input.content.length,
          wordCount: input.content.split(/\s+/).filter(Boolean).length,
        },
      });
    },
    [createCapture]
  );

  /**
   * Create a voice memo capture
   */
  const createVoiceCapture = useCallback(
    async (input: VoiceCaptureInput): Promise<string> => {
      if (!input.localUri) {
        throw new Error("Local URI is required for voice capture");
      }

      return createCapture("voice", {
        title: input.title,
        mediaUrl: input.localUri, // Will be uploaded and replaced with remote URL
        mediaMimeType: input.mimeType,
        payload: {
          localUri: input.localUri,
          durationMs: input.durationMs,
          isUploaded: false,
        },
      });
    },
    [createCapture]
  );

  /**
   * Create a photo capture
   */
  const createPhotoCapture = useCallback(
    async (input: PhotoCaptureInput): Promise<string> => {
      if (!input.localUri) {
        throw new Error("Local URI is required for photo capture");
      }

      return createCapture("photo", {
        title: input.title,
        mediaUrl: input.localUri, // Will be uploaded and replaced with remote URL
        mediaMimeType: input.mimeType,
        payload: {
          localUri: input.localUri,
          width: input.width,
          height: input.height,
          isUploaded: false,
        },
      });
    },
    [createCapture]
  );

  /**
   * Create a flagged passage capture
   */
  const createFlagCapture = useCallback(
    async (input: FlagCaptureInput): Promise<string> => {
      if (!input.documentId) {
        throw new Error("Document ID is required for flag capture");
      }

      if (!input.excerpt) {
        throw new Error("Excerpt is required for flag capture");
      }

      return createCapture("flag", {
        title: input.note ? `Flag: ${input.note.slice(0, 50)}` : "Flagged Passage",
        content: input.excerpt,
        payload: {
          documentId: input.documentId,
          excerpt: input.excerpt,
          note: input.note,
        },
      });
    },
    [createCapture]
  );

  return {
    createTextCapture,
    createVoiceCapture,
    createPhotoCapture,
    createFlagCapture,
    isCreating,
    error,
    clearError,
  };
}

export default useCapture;
