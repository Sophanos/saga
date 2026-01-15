/**
 * useDeepLinks - Tauri deep link handler for rhei:// URLs
 *
 * Uses the @tauri-apps/plugin-deep-link plugin to handle incoming URLs
 * on macOS desktop. Parses URLs and triggers navigation in the SPA.
 */

import { useEffect, useCallback } from "react";
import { onOpenUrl, getCurrent } from "@tauri-apps/plugin-deep-link";
import {
  parseRheiUrl,
  isRheiDeepLink,
  type RheiDeepLink,
} from "@mythos/core";
import { useArtifactStore, useProjectStore } from "@mythos/state";

interface UseDeepLinksOptions {
  enabled?: boolean;
  onDeepLink?: (link: RheiDeepLink) => void;
  onNavigate?: (path: string) => void;
}

export function useDeepLinks(options: UseDeepLinksOptions = {}): void {
  const { enabled = true, onDeepLink, onNavigate } = options;

  const handleUrl = useCallback(
    (url: string) => {
      if (!isRheiDeepLink(url)) {
        console.log("[DeepLink] Ignoring non-rhei URL:", url);
        return;
      }

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
          handleProjectLink(link, onNavigate);
          break;

        case "document":
          handleDocumentLink(link, onNavigate);
          break;

        case "entity":
          handleEntityLink(link, onNavigate);
          break;

        case "artifact":
          handleArtifactLink(link, onNavigate);
          break;
      }
    },
    [onDeepLink, onNavigate]
  );

  // Handle URLs that triggered app launch
  useEffect(() => {
    if (!enabled) return;

    const handleInitialUrls = async () => {
      try {
        const urls = await getCurrent();
        if (urls && urls.length > 0) {
          // Handle the most recent URL
          handleUrl(urls[urls.length - 1]);
        }
      } catch (error) {
        // Plugin may not be available in dev mode
        console.log("[DeepLink] getCurrent not available:", error);
      }
    };

    handleInitialUrls();
  }, [enabled, handleUrl]);

  // Listen for URLs while app is running
  useEffect(() => {
    if (!enabled) return;

    let unlistenFn: (() => void) | undefined;

    const setupListener = async () => {
      try {
        unlistenFn = await onOpenUrl((urls) => {
          if (urls && urls.length > 0) {
            // Handle the most recent URL
            handleUrl(urls[urls.length - 1]);
          }
        });
      } catch (error) {
        // Plugin may not be available in dev mode
        console.log("[DeepLink] onOpenUrl not available:", error);
      }
    };

    setupListener();

    return () => {
      unlistenFn?.();
    };
  }, [enabled, handleUrl]);
}

// Navigation handlers

function handleProjectLink(
  link: Extract<RheiDeepLink, { target: "project" }>,
  onNavigate?: (path: string) => void
) {
  useProjectStore.getState().setCurrentProjectId(link.projectId);
  onNavigate?.(`/project/${link.projectId}`);
}

function handleDocumentLink(
  link: Extract<RheiDeepLink, { target: "document" }>,
  onNavigate?: (path: string) => void
) {
  useProjectStore.getState().setCurrentProjectId(link.projectId);

  // Build path with hash for focus
  let path = `/project/${link.projectId}/document/${link.documentId}`;
  if (link.focusId) {
    path += `#${link.focusId}`;
  }

  onNavigate?.(path);
}

function handleEntityLink(
  link: Extract<RheiDeepLink, { target: "entity" }>,
  onNavigate?: (path: string) => void
) {
  useProjectStore.getState().setCurrentProjectId(link.projectId);
  onNavigate?.(`/project/${link.projectId}/entity/${link.entityId}`);
}

function handleArtifactLink(
  link: Extract<RheiDeepLink, { target: "artifact" }>,
  onNavigate?: (path: string) => void
) {
  useProjectStore.getState().setCurrentProjectId(link.projectId);

  // Set artifact focus if provided
  if (link.focusId) {
    useArtifactStore.getState().setFocusId(link.artifactKey, link.focusId);
  }

  // Build path with hash for focus
  let path = `/project/${link.projectId}/artifact/${link.artifactKey}`;
  if (link.focusId) {
    path += `#${link.focusId}`;
  }

  onNavigate?.(path);
}

export default useDeepLinks;
