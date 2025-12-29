import { useCallback } from "react";
import {
  User,
  MapPin,
  Sword,
  Wand2,
  Building2,
  GitBranch,
  FileText,
  Check,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button, cn } from "@mythos/ui";
import {
  useMythosStore,
  type ChatToolInvocation,
  type ToolInvocationStatus,
} from "../../../stores";
import { useEntityPersistence } from "../../../hooks/useEntityPersistence";
import { useRelationshipPersistence } from "../../../hooks/useRelationshipPersistence";
import type { Entity, EntityType, RelationType } from "@mythos/core";

interface ToolResultCardProps {
  messageId: string;
  tool: ChatToolInvocation;
}

// Entity type icons
const ENTITY_ICONS: Record<string, typeof User> = {
  character: User,
  location: MapPin,
  item: Sword,
  magic_system: Wand2,
  faction: Building2,
};

// Tool action labels
const TOOL_LABELS: Record<string, string> = {
  create_entity: "Create Entity",
  create_relationship: "Create Relationship",
  generate_content: "Generate Content",
  update_entity: "Update Entity",
};

function getStatusIcon(status: ToolInvocationStatus) {
  switch (status) {
    case "proposed":
      return null;
    case "accepted":
    case "executed":
      return <Check className="w-3.5 h-3.5 text-mythos-accent-green" />;
    case "rejected":
      return <X className="w-3.5 h-3.5 text-mythos-text-muted" />;
    case "failed":
      return <AlertCircle className="w-3.5 h-3.5 text-mythos-accent-red" />;
    default:
      return null;
  }
}

function getStatusLabel(status: ToolInvocationStatus): string {
  switch (status) {
    case "proposed":
      return "Proposed";
    case "accepted":
      return "Accepted";
    case "executed":
      return "Created";
    case "rejected":
      return "Rejected";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

export function ToolResultCard({ messageId, tool }: ToolResultCardProps) {
  const updateToolStatus = useMythosStore((s) => s.updateToolStatus);
  const addEntity = useMythosStore((s) => s.addEntity);
  const addRelationship = useMythosStore((s) => s.addRelationship);
  const projectId = useMythosStore((s) => s.project.currentProject?.id);
  const entities = useMythosStore((s) => s.world.entities);

  const { createEntity } = useEntityPersistence();
  const { createRelationship } = useRelationshipPersistence();

  const args = (tool.args ?? {}) as Record<string, unknown>;
  const getArg = <T,>(key: string, fallback?: T): T | undefined =>
    args[key] as T | undefined ?? fallback;
  const isProposed = tool.status === "proposed";
  const isProcessing = tool.status === "accepted";

  // Handle accepting the tool proposal
  const handleAccept = useCallback(async () => {
    if (!projectId) return;

    updateToolStatus(messageId, "accepted");

    try {
      if (tool.toolName === "create_entity") {
        const entityType = getArg<EntityType>("type") ?? "character";
        const now = new Date();

        // Build entity based on type
        const baseEntity = {
          id: crypto.randomUUID(),
          name: getArg<string>("name") ?? "Unnamed",
          type: entityType,
          aliases: getArg<string[]>("aliases") ?? [],
          notes: getArg<string>("notes"),
          createdAt: now,
          updatedAt: now,
          mentions: [],
          properties: {},
        };

        let entity: Record<string, unknown> = { ...baseEntity };

        // Add type-specific fields
        if (entityType === "character") {
          entity = {
            ...entity,
            archetype: getArg<string>("archetype"),
            traits: [],
            status: {},
            visualDescription: {},
            backstory: getArg<string>("backstory"),
            goals: getArg<string[]>("goals") ?? [],
            fears: getArg<string[]>("fears") ?? [],
          };
        } else if (entityType === "location") {
          entity = {
            ...entity,
            climate: getArg<string>("climate"),
            atmosphere: getArg<string>("atmosphere"),
          };
        } else if (entityType === "item") {
          entity = {
            ...entity,
            category: getArg<string>("category") ?? "other",
            abilities: getArg<string[]>("abilities") ?? [],
          };
        } else if (entityType === "faction") {
          entity = {
            ...entity,
            leader: getArg<string>("leader"),
            headquarters: getArg<string>("headquarters"),
            goals: getArg<string[]>("factionGoals") ?? [],
          };
        } else if (entityType === "magic_system") {
          entity = {
            ...entity,
            rules: getArg<string[]>("rules") ?? [],
            limitations: getArg<string[]>("limitations") ?? [],
          };
        }

        const result = await createEntity(entity as unknown as Entity, projectId);
        if (result.data) {
          addEntity(result.data);
          updateToolStatus(messageId, "executed");
        } else {
          updateToolStatus(messageId, "failed", result.error ?? "Failed to create entity");
        }
      } else if (tool.toolName === "create_relationship") {
        // Find entities by name
        const sourceName = getArg<string>("sourceName") ?? "";
        const targetName = getArg<string>("targetName") ?? "";
        
        let sourceId: string | null = null;
        let targetId: string | null = null;

        entities.forEach((entity) => {
          if (entity.name.toLowerCase() === sourceName.toLowerCase()) {
            sourceId = entity.id;
          }
          if (entity.name.toLowerCase() === targetName.toLowerCase()) {
            targetId = entity.id;
          }
        });

        if (!sourceId || !targetId) {
          updateToolStatus(
            messageId,
            "failed",
            `Could not find entities: ${!sourceId ? sourceName : ""} ${!targetId ? targetName : ""}`
          );
          return;
        }

        const relationship = {
          id: crypto.randomUUID(),
          sourceId,
          targetId,
          type: getArg<RelationType>("type") ?? "knows",
          bidirectional: getArg<boolean>("bidirectional") ?? false,
          notes: getArg<string>("notes"),
          createdAt: new Date(),
        };

        const result = await createRelationship(relationship, projectId);
        if (result.data) {
          addRelationship(result.data);
          updateToolStatus(messageId, "executed");
        } else {
          updateToolStatus(messageId, "failed", result.error ?? "Failed to create relationship");
        }
      } else {
        // For other tools, just mark as executed
        updateToolStatus(messageId, "executed");
      }
    } catch (error) {
      updateToolStatus(
        messageId,
        "failed",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }, [
    messageId,
    tool.toolName,
    args,
    projectId,
    updateToolStatus,
    createEntity,
    createRelationship,
    addEntity,
    addRelationship,
    entities,
  ]);

  // Handle rejecting the tool proposal
  const handleReject = useCallback(() => {
    updateToolStatus(messageId, "rejected");
  }, [messageId, updateToolStatus]);

  // Get icon based on tool type
  const getIcon = () => {
    if (tool.toolName === "create_entity") {
      const Icon = ENTITY_ICONS[getArg<string>("type") ?? "character"] ?? User;
      return <Icon className="w-4 h-4" />;
    }
    if (tool.toolName === "create_relationship") {
      return <GitBranch className="w-4 h-4" />;
    }
    return <FileText className="w-4 h-4" />;
  };

  // Build summary text
  const getSummary = () => {
    if (tool.toolName === "create_entity") {
      return `${getArg<string>("type")}: "${getArg<string>("name")}"`;
    }
    if (tool.toolName === "create_relationship") {
      return `${getArg<string>("sourceName")} → ${getArg<string>("type")} → ${getArg<string>("targetName")}`;
    }
    if (tool.toolName === "generate_content") {
      return `${getArg<string>("contentType")}: ${getArg<string>("subject")}`;
    }
    return TOOL_LABELS[tool.toolName] ?? tool.toolName;
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-3 my-2",
        isProposed
          ? "border-mythos-accent-purple/30 bg-mythos-accent-purple/5"
          : tool.status === "executed"
            ? "border-mythos-accent-green/30 bg-mythos-accent-green/5"
            : tool.status === "failed"
              ? "border-mythos-accent-red/30 bg-mythos-accent-red/5"
              : "border-mythos-text-muted/20 bg-mythos-bg-tertiary/50"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded bg-mythos-bg-tertiary flex items-center justify-center text-mythos-accent-purple">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-mythos-text-primary truncate">
            {TOOL_LABELS[tool.toolName] ?? tool.toolName}
          </div>
          <div className="text-[10px] text-mythos-text-muted truncate">
            {getSummary()}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {getStatusIcon(tool.status)}
          <span
            className={cn(
              "text-[10px]",
              tool.status === "executed"
                ? "text-mythos-accent-green"
                : tool.status === "failed"
                  ? "text-mythos-accent-red"
                  : "text-mythos-text-muted"
            )}
          >
            {getStatusLabel(tool.status)}
          </span>
        </div>
      </div>

      {/* Details preview */}
      {getArg<string>("notes") && (
        <p className="text-xs text-mythos-text-muted mb-2 line-clamp-2">
          {getArg<string>("notes")}
        </p>
      )}

      {/* Error message */}
      {tool.error && (
        <p className="text-xs text-mythos-accent-red mb-2">{tool.error}</p>
      )}

      {/* Actions */}
      {isProposed && (
        <div className="flex items-center gap-2 mt-2">
          <Button
            size="sm"
            onClick={handleAccept}
            className="flex-1 h-7 text-xs gap-1"
          >
            <Check className="w-3 h-3" />
            Create
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReject}
            className="flex-1 h-7 text-xs gap-1"
          >
            <X className="w-3 h-3" />
            Cancel
          </Button>
        </div>
      )}

      {/* Processing state */}
      {isProcessing && (
        <div className="flex items-center gap-2 mt-2 text-xs text-mythos-text-muted">
          <Loader2 className="w-3 h-3 animate-spin" />
          Creating...
        </div>
      )}
    </div>
  );
}
