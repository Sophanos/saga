/**
 * useRheiDeepLinkListener - Expo deep link listener for rhei:// URLs
 *
 * Listens for incoming deep links (initial URL and runtime events),
 * parses them, and handles navigation + focus state updates.
 */

import { useEffect, useCallback } from "react";
import { Linking, Platform } from "react-native";
import { useRouter } from "expo-router";
import {
  parseRheiUrl,
  isRheiDeepLink,
  extractFocusIdFromUrl,
  type RheiDeepLink,
} from "@mythos/core";
import { useArtifactStore, useProjectStore } from "@mythos/state";

interface UseRheiDeepLinkListenerOptions {
  enabled?: boolean;
  onDeepLink?: (link: RheiDeepLink) => void;
}

export function useRheiDeepLinkListener(
  options: UseRheiDeepLinkListenerOptions = {}
): void {
  const { enabled = true, onDeepLink } = options;
  const router = useRouter();

  const handleUrl = useCallback(
    (url: string | null) => {
      if (!url) return;
      if (!isRheiDeepLink(url)) return;

      const link = parseRheiUrl(url);
      if (!link) {
        console.warn("[DeepLink] Failed to parse URL:", url);
        return;
      }

      console.log("[DeepLink] Handling:", link);

      // Notify callback
      onDeepLink?.(link);

      // Handle navigation and focus based on link type
      switch (link.target) {
        case "project":
          handleProjectLink(link, router);
          break;

        case "document":
          handleDocumentLink(link, router);
          break;

        case "entity":
          handleEntityLink(link, router);
          break;

        case "artifact":
          handleArtifactLink(link, router);
          break;
      }
    },
    [router, onDeepLink]
  );

  // Handle initial URL (app opened via deep link)
  useEffect(() => {
    if (!enabled) return;

    const handleInitialUrl = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          handleUrl(initialUrl);
        }
      } catch (error) {
        console.warn("[DeepLink] Failed to get initial URL:", error);
      }
    };

    handleInitialUrl();
  }, [enabled, handleUrl]);

  // Handle runtime URL events (app already open)
  useEffect(() => {
    if (!enabled) return;

    const subscription = Linking.addEventListener("url", (event) => {
      handleUrl(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, [enabled, handleUrl]);
}

// Navigation handlers

function handleProjectLink(
  link: Extract<RheiDeepLink, { target: "project" }>,
  router: ReturnType<typeof useRouter>
) {
  useProjectStore.getState().setCurrentProjectId(link.projectId);
  router.push(`/project/${link.projectId}`);
}

function handleDocumentLink(
  link: Extract<RheiDeepLink, { target: "document" }>,
  router: ReturnType<typeof useRouter>
) {
  useProjectStore.getState().setCurrentProjectId(link.projectId);

  // Set focus if provided
  if (link.focusId) {
    // Documents use editor focus - store in a document focus state if needed
    console.log("[DeepLink] Document focus:", link.focusId);
  }

  router.push(`/project/${link.projectId}/document/${link.documentId}`);
}

function handleEntityLink(
  link: Extract<RheiDeepLink, { target: "entity" }>,
  router: ReturnType<typeof useRouter>
) {
  useProjectStore.getState().setCurrentProjectId(link.projectId);
  router.push(`/project/${link.projectId}/entity/${link.entityId}`);
}

function handleArtifactLink(
  link: Extract<RheiDeepLink, { target: "artifact" }>,
  router: ReturnType<typeof useRouter>
) {
  useProjectStore.getState().setCurrentProjectId(link.projectId);

  // Set artifact focus if provided
  if (link.focusId) {
    useArtifactStore.getState().setFocusId(link.artifactKey, link.focusId);
  }

  router.push(`/project/${link.projectId}/artifact/${link.artifactKey}`);
}

/**
 * Hook to get the current focus ID for an artifact from the store
 */
export function useArtifactDeepLinkFocus(artifactKey: string): string | null {
  return useArtifactStore((s) => s.focusedElements[artifactKey] ?? null);
}

/**
 * Utility to clear focus after it's been handled (e.g., after scroll)
 */
export function clearArtifactFocus(artifactKey: string): void {
  // Clear focus after a delay to allow scroll animation
  setTimeout(() => {
    useArtifactStore.getState().setFocusId(artifactKey, null);
  }, 1500);
}
