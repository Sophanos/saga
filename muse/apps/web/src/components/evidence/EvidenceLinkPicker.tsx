import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { Button, cn } from "@mythos/ui";
import { api } from "../../../../../convex/_generated/api";
import { useMythosStore } from "../../stores";

export interface EvidenceLinkPickerProps {
  projectId: string;
  assetId: string;
  regionId?: string;
  className?: string;
  onCreated?: (linkId: string) => void;
}

export function EvidenceLinkPicker({
  projectId,
  assetId,
  regionId,
  className,
  onCreated,
}: EvidenceLinkPickerProps): JSX.Element {
  const entities = useMythosStore((s) => Array.from(s.world.entities.values()));
  const documents = useMythosStore((s) => s.document.documents);
  const createEvidenceLink = useMutation(api.evidence.createEvidenceLink);

  const [targetType, setTargetType] = useState<"entity" | "document">("entity");
  const [targetId, setTargetId] = useState<string>("");
  const [relation, setRelation] = useState<string>("");
  const [claimPath, setClaimPath] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const options = useMemo(() => {
    if (targetType === "entity") {
      return entities.map((entity) => ({ id: entity.id, label: entity.name }));
    }
    return documents.map((doc) => ({ id: doc.id, label: doc.title ?? "Untitled" }));
  }, [documents, entities, targetType]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <label className="text-xs text-mythos-text-muted">Target</label>
        <select
          className="text-xs bg-mythos-bg-elevated border border-mythos-border-default rounded px-2 py-1"
          value={targetType}
          onChange={(event) => {
            const value = event.target.value === "document" ? "document" : "entity";
            setTargetType(value);
            setTargetId("");
          }}
        >
          <option value="entity">Entity</option>
          <option value="document">Document</option>
        </select>
        <select
          className="flex-1 text-xs bg-mythos-bg-elevated border border-mythos-border-default rounded px-2 py-1"
          value={targetId}
          onChange={(event) => setTargetId(event.target.value)}
        >
          <option value="">Select…</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <input
          className="flex-1 text-xs bg-mythos-bg-elevated border border-mythos-border-default rounded px-2 py-1"
          value={relation}
          placeholder="Relation (e.g. depicts)"
          onChange={(event) => setRelation(event.target.value)}
        />
        <input
          className="flex-1 text-xs bg-mythos-bg-elevated border border-mythos-border-default rounded px-2 py-1"
          value={claimPath}
          placeholder="Claim path"
          onChange={(event) => setClaimPath(event.target.value)}
        />
      </div>
      <Button
        size="sm"
        disabled={!targetId || isSaving}
        onClick={async () => {
          if (!targetId) return;
          setIsSaving(true);
          try {
            const result = await createEvidenceLink({
              projectId,
              assetId,
              regionId,
              targetType,
              targetId,
              relation: relation.trim() || undefined,
              claimPath: claimPath.trim() || undefined,
            });
            const linkId = (result as { linkId?: string } | null)?.linkId;
            if (linkId && onCreated) onCreated(linkId);
          } catch (error) {
            console.error("[EvidenceLinkPicker] Failed to create link:", error);
          } finally {
            setIsSaving(false);
          }
        }}
      >
        Link evidence
      </Button>
    </div>
  );
}
