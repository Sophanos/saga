/**
 * Saga MCP Resource Providers
 *
 * Defines resources exposed via the MCP server.
 * Resources provide read access to Saga project data.
 */

import type {
  Resource,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/types.js";
import type { SagaApiConfig } from "./types.js";

// =============================================================================
// Extended Resource Type with Content
// =============================================================================

/**
 * Extended resource type that includes content for the read operation.
 */
export interface ResourceWithContent extends Resource {
  text?: string;
}

// =============================================================================
// Resource Templates
// =============================================================================

/**
 * Resource template for listing projects.
 */
export const projectsListTemplate: ResourceTemplate = {
  uriTemplate: "saga://projects",
  name: "Projects List",
  description: "List of all worldbuilding projects accessible to the user",
  mimeType: "application/json",
};

/**
 * Resource template for project details.
 */
export const projectDetailsTemplate: ResourceTemplate = {
  uriTemplate: "saga://projects/{projectId}",
  name: "Project Details",
  description: "Details of a specific worldbuilding project including metadata and entity counts",
  mimeType: "application/json",
};

/**
 * Resource template for project entities.
 */
export const projectEntitiesTemplate: ResourceTemplate = {
  uriTemplate: "saga://projects/{projectId}/entities",
  name: "Project Entities",
  description: "All entities (characters, locations, items, etc.) in a project",
  mimeType: "application/json",
};

/**
 * Resource template for entity details.
 */
export const entityDetailsTemplate: ResourceTemplate = {
  uriTemplate: "saga://projects/{projectId}/entities/{entityId}",
  name: "Entity Details",
  description: "Detailed information about a specific entity including properties and relationships",
  mimeType: "application/json",
};

/**
 * Resource template for project relationships.
 */
export const projectRelationshipsTemplate: ResourceTemplate = {
  uriTemplate: "saga://projects/{projectId}/relationships",
  name: "Project Relationships",
  description: "All relationships between entities in a project (the project graph)",
  mimeType: "application/json",
};

/**
 * Resource template for project documents.
 */
export const projectDocumentsTemplate: ResourceTemplate = {
  uriTemplate: "saga://projects/{projectId}/documents",
  name: "Project Documents",
  description: "All documents (chapters, scenes, notes) in a project",
  mimeType: "application/json",
};

/**
 * Resource template for document content.
 */
export const documentContentTemplate: ResourceTemplate = {
  uriTemplate: "saga://projects/{projectId}/documents/{documentId}",
  name: "Document Content",
  description: "Full content of a specific document",
  mimeType: "text/plain",
};

/**
 * Resource template for project graph visualization.
 */
export const projectGraphTemplate: ResourceTemplate = {
  uriTemplate: "saga://projects/{projectId}/graph",
  name: "Project Graph",
  description: "The entity relationship graph in a visualization-friendly format",
  mimeType: "application/json",
};

// =============================================================================
// All Resource Templates
// =============================================================================

export const RESOURCE_TEMPLATES: ResourceTemplate[] = [
  projectsListTemplate,
  projectDetailsTemplate,
  projectEntitiesTemplate,
  entityDetailsTemplate,
  projectRelationshipsTemplate,
  projectDocumentsTemplate,
  documentContentTemplate,
  projectGraphTemplate,
];

// =============================================================================
// Resource Fetching
// =============================================================================

/**
 * Parses a saga:// URI and returns the resource type and parameters.
 */
export function parseResourceUri(
  uri: string
): { type: string; params: Record<string, string> } | null {
  if (!uri.startsWith("saga://")) {
    return null;
  }

  const path = uri.slice("saga://".length);
  const parts = path.split("/");

  // saga://projects
  if (parts.length === 1 && parts[0] === "projects") {
    return { type: "projects_list", params: {} };
  }

  // saga://projects/{projectId}
  if (parts.length === 2 && parts[0] === "projects") {
    return { type: "project_details", params: { projectId: parts[1] } };
  }

  // saga://projects/{projectId}/entities
  if (parts.length === 3 && parts[0] === "projects" && parts[2] === "entities") {
    return { type: "project_entities", params: { projectId: parts[1] } };
  }

  // saga://projects/{projectId}/entities/{entityId}
  if (parts.length === 4 && parts[0] === "projects" && parts[2] === "entities") {
    return {
      type: "entity_details",
      params: { projectId: parts[1], entityId: parts[3] },
    };
  }

  // saga://projects/{projectId}/relationships
  if (parts.length === 3 && parts[0] === "projects" && parts[2] === "relationships") {
    return { type: "project_relationships", params: { projectId: parts[1] } };
  }

  // saga://projects/{projectId}/documents
  if (parts.length === 3 && parts[0] === "projects" && parts[2] === "documents") {
    return { type: "project_documents", params: { projectId: parts[1] } };
  }

  // saga://projects/{projectId}/documents/{documentId}
  if (parts.length === 4 && parts[0] === "projects" && parts[2] === "documents") {
    return {
      type: "document_content",
      params: { projectId: parts[1], documentId: parts[3] },
    };
  }

  // saga://projects/{projectId}/graph
  if (parts.length === 3 && parts[0] === "projects" && parts[2] === "graph") {
    return { type: "project_graph", params: { projectId: parts[1] } };
  }

  return null;
}

/**
 * Fetches a resource from the Saga API.
 */
export async function fetchResource(
  uri: string,
  config: SagaApiConfig
): Promise<ResourceWithContent | null> {
  const parsed = parseResourceUri(uri);
  if (!parsed) {
    return null;
  }

  const { type, params } = parsed;

  try {
    switch (type) {
      case "projects_list":
        return await fetchProjectsList(config);
      case "project_details":
        return await fetchProjectDetails(params.projectId, config);
      case "project_entities":
        return await fetchProjectEntities(params.projectId, config);
      case "entity_details":
        return await fetchEntityDetails(
          params.projectId,
          params.entityId,
          config
        );
      case "project_relationships":
        return await fetchProjectRelationships(params.projectId, config);
      case "project_documents":
        return await fetchProjectDocuments(params.projectId, config);
      case "document_content":
        return await fetchDocumentContent(
          params.projectId,
          params.documentId,
          config
        );
      case "project_graph":
        return await fetchProjectGraph(params.projectId, config);
      default:
        return null;
    }
  } catch (error) {
    console.error(`[saga-mcp] Error fetching resource ${uri}:`, error);
    return null;
  }
}

// =============================================================================
// Resource Fetch Implementations
// =============================================================================

async function fetchFromSupabase(
  endpoint: string,
  config: SagaApiConfig
): Promise<unknown> {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${endpoint}`, {
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchProjectsList(config: SagaApiConfig): Promise<ResourceWithContent> {
  const projects = await fetchFromSupabase(
    "projects?select=id,name,description,created_at,updated_at",
    config
  );

  return {
    uri: "saga://projects",
    name: "Projects",
    description: "List of worldbuilding projects",
    mimeType: "application/json",
    text: JSON.stringify(projects, null, 2),
  };
}

async function fetchProjectDetails(
  projectId: string,
  config: SagaApiConfig
): Promise<ResourceWithContent> {
  const project = await fetchFromSupabase(
    `projects?id=eq.${projectId}&select=*`,
    config
  );

  // Get entity counts
  const entities = await fetchFromSupabase(
    `entities?project_id=eq.${projectId}&select=id,type`,
    config
  ) as Array<{ id: string; type: string }>;

  const entityCounts: Record<string, number> = {};
  for (const entity of entities) {
    entityCounts[entity.type] = (entityCounts[entity.type] || 0) + 1;
  }

  const result = {
    ...(Array.isArray(project) ? project[0] : project),
    entityCounts,
    totalEntities: entities.length,
  };

  return {
    uri: `saga://projects/${projectId}`,
    name: "Project Details",
    description: `Details for project ${projectId}`,
    mimeType: "application/json",
    text: JSON.stringify(result, null, 2),
  };
}

async function fetchProjectEntities(
  projectId: string,
  config: SagaApiConfig
): Promise<ResourceWithContent> {
  const entities = await fetchFromSupabase(
    `entities?project_id=eq.${projectId}&select=id,name,type,aliases,notes,properties,created_at,updated_at`,
    config
  );

  return {
    uri: `saga://projects/${projectId}/entities`,
    name: "Project Entities",
    description: `All entities in project ${projectId}`,
    mimeType: "application/json",
    text: JSON.stringify(entities, null, 2),
  };
}

async function fetchEntityDetails(
  projectId: string,
  entityId: string,
  config: SagaApiConfig
): Promise<ResourceWithContent> {
  const entity = await fetchFromSupabase(
    `entities?id=eq.${entityId}&project_id=eq.${projectId}&select=*`,
    config
  );

  // Get relationships where this entity is source or target
  const relationships = await fetchFromSupabase(
    `relationships?or=(source_id.eq.${entityId},target_id.eq.${entityId})&select=id,source_id,target_id,type,notes`,
    config
  );

  const result = {
    ...(Array.isArray(entity) ? entity[0] : entity),
    relationships,
  };

  return {
    uri: `saga://projects/${projectId}/entities/${entityId}`,
    name: "Entity Details",
    description: `Details for entity ${entityId}`,
    mimeType: "application/json",
    text: JSON.stringify(result, null, 2),
  };
}

async function fetchProjectRelationships(
  projectId: string,
  config: SagaApiConfig
): Promise<ResourceWithContent> {
  // Get all relationships for entities in this project
  const relationships = await fetchFromSupabase(
    `relationships?select=id,source_id,target_id,type,notes,entities!relationships_source_id_fkey(id,name,type)&source_id=in.(select id from entities where project_id=eq.${projectId})`,
    config
  );

  return {
    uri: `saga://projects/${projectId}/relationships`,
    name: "Project Relationships",
    description: `All relationships in project ${projectId}`,
    mimeType: "application/json",
    text: JSON.stringify(relationships, null, 2),
  };
}

async function fetchProjectDocuments(
  projectId: string,
  config: SagaApiConfig
): Promise<ResourceWithContent> {
  const documents = await fetchFromSupabase(
    `documents?project_id=eq.${projectId}&select=id,title,kind,parent_id,order,created_at,updated_at`,
    config
  );

  return {
    uri: `saga://projects/${projectId}/documents`,
    name: "Project Documents",
    description: `All documents in project ${projectId}`,
    mimeType: "application/json",
    text: JSON.stringify(documents, null, 2),
  };
}

async function fetchDocumentContent(
  projectId: string,
  documentId: string,
  config: SagaApiConfig
): Promise<ResourceWithContent> {
  const document = await fetchFromSupabase(
    `documents?id=eq.${documentId}&project_id=eq.${projectId}&select=id,title,content,kind`,
    config
  );

  const doc = Array.isArray(document) ? document[0] : document;
  const docTyped = doc as { title?: string; content?: string | object } | undefined;
  const content = typeof docTyped?.content === "string"
    ? docTyped.content
    : JSON.stringify(docTyped?.content || "");

  return {
    uri: `saga://projects/${projectId}/documents/${documentId}`,
    name: docTyped?.title || "Document",
    description: `Content of document ${documentId}`,
    mimeType: "text/plain",
    text: content,
  };
}

async function fetchProjectGraph(
  projectId: string,
  config: SagaApiConfig
): Promise<ResourceWithContent> {
  // Get entities
  const entities = await fetchFromSupabase(
    `entities?project_id=eq.${projectId}&select=id,name,type`,
    config
  ) as Array<{ id: string; name: string; type: string }>;

  // Get relationships for these entities
  const entityIds = entities.map((e) => e.id);
  const relationships = entityIds.length > 0
    ? await fetchFromSupabase(
        `relationships?source_id=in.(${entityIds.join(",")})&select=id,source_id,target_id,type,notes`,
        config
      ) as Array<{
        id: string;
        source_id: string;
        target_id: string;
        type: string;
        notes?: string;
      }>
    : [];

  // Build graph format
  const graph = {
    nodes: entities.map((e) => ({
      id: e.id,
      label: e.name,
      type: e.type,
    })),
    edges: relationships.map((r) => ({
      id: r.id,
      source: r.source_id,
      target: r.target_id,
      label: r.type,
      notes: r.notes,
    })),
    metadata: {
      nodeCount: entities.length,
      edgeCount: relationships.length,
      projectId,
    },
  };

  return {
    uri: `saga://projects/${projectId}/graph`,
    name: "Project Graph",
    description: `Entity relationship graph for project ${projectId}`,
    mimeType: "application/json",
    text: JSON.stringify(graph, null, 2),
  };
}

// =============================================================================
// Dynamic Resource Discovery
// =============================================================================

/**
 * Lists all available resources for a given project.
 */
export async function listProjectResources(
  projectId: string,
  config: SagaApiConfig
): Promise<Resource[]> {
  const resources: Resource[] = [];

  try {
    // Add project-level resources
    resources.push({
      uri: `saga://projects/${projectId}`,
      name: "Project Details",
      mimeType: "application/json",
    });

    resources.push({
      uri: `saga://projects/${projectId}/entities`,
      name: "All Entities",
      mimeType: "application/json",
    });

    resources.push({
      uri: `saga://projects/${projectId}/relationships`,
      name: "All Relationships",
      mimeType: "application/json",
    });

    resources.push({
      uri: `saga://projects/${projectId}/documents`,
      name: "All Documents",
      mimeType: "application/json",
    });

    resources.push({
      uri: `saga://projects/${projectId}/graph`,
      name: "Project Graph",
      mimeType: "application/json",
    });

    // Add individual entity resources
    const entities = await fetchFromSupabase(
      `entities?project_id=eq.${projectId}&select=id,name,type`,
      config
    ) as Array<{ id: string; name: string; type: string }>;

    for (const entity of entities) {
      resources.push({
        uri: `saga://projects/${projectId}/entities/${entity.id}`,
        name: `${entity.name} (${entity.type})`,
        description: `Details for ${entity.type}: ${entity.name}`,
        mimeType: "application/json",
      });
    }

    // Add individual document resources
    const documents = await fetchFromSupabase(
      `documents?project_id=eq.${projectId}&select=id,title,kind`,
      config
    ) as Array<{ id: string; title: string; kind: string }>;

    for (const doc of documents) {
      resources.push({
        uri: `saga://projects/${projectId}/documents/${doc.id}`,
        name: doc.title || `Untitled ${doc.kind}`,
        description: `${doc.kind}: ${doc.title}`,
        mimeType: "text/plain",
      });
    }
  } catch (error) {
    console.error(`[saga-mcp] Error listing resources for project ${projectId}:`, error);
  }

  return resources;
}
