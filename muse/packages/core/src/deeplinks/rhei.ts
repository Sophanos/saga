/**
 * Rhei Deep Link Utilities
 *
 * Centralized parsing and building of rhei:// deep links.
 * Supports project, document, entity, and artifact targets with focus IDs.
 */

export type RheiDeepLink =
  | { target: "project"; projectId: string }
  | { target: "document"; projectId: string; documentId: string; focusId?: string | null }
  | { target: "entity"; projectId: string; entityId: string }
  | { target: "artifact"; projectId: string; artifactKey: string; focusId?: string | null };

// URL patterns:
// rhei://project/:projectId
// rhei://project/:projectId/document/:documentId
// rhei://project/:projectId/entity/:entityId
// rhei://project/:projectId/artifact/:artifactKey
// rhei://project/:projectId/artifact/:artifactKey#focusId
// rhei://project/:projectId/artifact/:artifactKey?focus=focusId

const SCHEME_PATTERN = /^(rhei|mythos):\/\//;
const PROJECT_PATTERN = /^project\/([^/]+)$/;
const DOCUMENT_PATTERN = /^project\/([^/]+)\/document\/([^/?#]+)/;
const ENTITY_PATTERN = /^project\/([^/]+)\/entity\/([^/?#]+)/;
const ARTIFACT_PATTERN = /^project\/([^/]+)\/artifact\/([^/?#]+)/;

/**
 * Parse a rhei:// or mythos:// URL into a structured deep link
 */
export function parseRheiUrl(url: string): RheiDeepLink | null {
  if (!url) return null;

  // Remove scheme
  const withoutScheme = url.replace(SCHEME_PATTERN, "");
  if (withoutScheme === url) {
    // No recognized scheme
    return null;
  }

  // Extract hash fragment (focusId)
  const hashIndex = withoutScheme.indexOf("#");
  const queryIndex = withoutScheme.indexOf("?");
  const pathEndIndex =
    hashIndex >= 0 && queryIndex >= 0
      ? Math.min(hashIndex, queryIndex)
      : hashIndex >= 0
        ? hashIndex
        : queryIndex >= 0
          ? queryIndex
          : withoutScheme.length;

  const path = withoutScheme.slice(0, pathEndIndex);
  const hash = hashIndex >= 0 ? withoutScheme.slice(hashIndex + 1).split("?")[0] : null;
  const queryString = queryIndex >= 0 ? withoutScheme.slice(queryIndex + 1).split("#")[0] : null;

  // Parse query params for focus
  let queryFocusId: string | null = null;
  if (queryString) {
    const params = new URLSearchParams(queryString);
    queryFocusId = params.get("focus");
  }

  // Normalize focusId: prefer hash, fallback to query param
  const focusId = hash || queryFocusId || null;

  // Match patterns in order of specificity
  const documentMatch = path.match(DOCUMENT_PATTERN);
  if (documentMatch) {
    return {
      target: "document",
      projectId: decodeURIComponent(documentMatch[1]),
      documentId: decodeURIComponent(documentMatch[2]),
      focusId,
    };
  }

  const entityMatch = path.match(ENTITY_PATTERN);
  if (entityMatch) {
    return {
      target: "entity",
      projectId: decodeURIComponent(entityMatch[1]),
      entityId: decodeURIComponent(entityMatch[2]),
    };
  }

  const artifactMatch = path.match(ARTIFACT_PATTERN);
  if (artifactMatch) {
    return {
      target: "artifact",
      projectId: decodeURIComponent(artifactMatch[1]),
      artifactKey: decodeURIComponent(artifactMatch[2]),
      focusId,
    };
  }

  const projectMatch = path.match(PROJECT_PATTERN);
  if (projectMatch) {
    return {
      target: "project",
      projectId: decodeURIComponent(projectMatch[1]),
    };
  }

  return null;
}

/**
 * Build a rhei:// URL from a structured deep link
 */
export function buildRheiUrl(link: RheiDeepLink): string {
  const encode = encodeURIComponent;

  switch (link.target) {
    case "project":
      return `rhei://project/${encode(link.projectId)}`;

    case "document": {
      const base = `rhei://project/${encode(link.projectId)}/document/${encode(link.documentId)}`;
      return link.focusId ? `${base}#${encode(link.focusId)}` : base;
    }

    case "entity":
      return `rhei://project/${encode(link.projectId)}/entity/${encode(link.entityId)}`;

    case "artifact": {
      const base = `rhei://project/${encode(link.projectId)}/artifact/${encode(link.artifactKey)}`;
      return link.focusId ? `${base}#${encode(link.focusId)}` : base;
    }

    default: {
      const exhaustiveCheck: never = link;
      throw new Error(`Unknown deep link target: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}

/**
 * Extract focusId from a URL (hash fragment or query param)
 */
export function extractFocusIdFromUrl(url: string): string | null {
  const hashIndex = url.indexOf("#");
  if (hashIndex >= 0) {
    const hash = url.slice(hashIndex + 1).split("?")[0];
    if (hash) return decodeURIComponent(hash);
  }

  const queryIndex = url.indexOf("?");
  if (queryIndex >= 0) {
    const queryString = url.slice(queryIndex + 1).split("#")[0];
    const params = new URLSearchParams(queryString);
    const focus = params.get("focus");
    if (focus) return decodeURIComponent(focus);
  }

  return null;
}

/**
 * Check if a URL is a rhei:// or mythos:// deep link
 */
export function isRheiDeepLink(url: string): boolean {
  return SCHEME_PATTERN.test(url);
}

/**
 * Convert a mythos:// URL to rhei:// (for migration)
 */
export function normalizeScheme(url: string): string {
  return url.replace(/^mythos:\/\//, "rhei://");
}
