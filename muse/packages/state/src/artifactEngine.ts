import type { ArtifactEnvelopeByType } from "@mythos/core";

export type JsonPatchOperation =
  | { op: "test"; path: string; value: unknown }
  | { op: "add"; path: string; value: unknown }
  | { op: "replace"; path: string; value: unknown }
  | { op: "remove"; path: string }
  | { op: "move"; from: string; path: string }
  | { op: "copy"; from: string; path: string };

export type ArtifactOp =
  | { type: "diagram.edge.add"; edge: { edgeId: string; source: string; target: string; data?: unknown; type?: string } }
  | { type: "diagram.edge.update"; edgeId: string; updates: Record<string, unknown> }
  | { type: "diagram.node.upsert"; node: { nodeId: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> } }
  | { type: "diagram.node.move"; nodeId: string; position: { x: number; y: number } }
  | { type: "table.row.reorder"; rowOrder: string[] }
  | { type: "table.row.add"; row: { rowId: string; entityId?: string; cells: Record<string, unknown> } }
  | { type: "table.cell.update"; rowId: string; columnId: string; value: unknown }
  | { type: "table.rows.remove"; rowIds: string[] }
  | { type: "timeline.item.upsert"; item: { itemId: string; start: string; end?: string; content: string; groupId?: string } }
  | { type: "timeline.item.update"; itemId: string; updates: Record<string, unknown> }
  | { type: "outline.item.move"; itemId: string; newParentId?: string; newIndex: number }
  | { type: "prose.block.replace"; blockId: string; markdown: string };

export interface ArtifactPatch {
  artifactId: string;
  baseRev: number;
  op: ArtifactOp;
  patch: JsonPatchOperation[];
}

export interface ArtifactOpLogEntry {
  id: string;
  artifactId: string;
  baseRev: number;
  nextRev: number;
  op: ArtifactOp;
  patch: JsonPatchOperation[];
  createdAt: number;
}

function decodePointer(path: string): string[] {
  if (!path.startsWith("/")) return [];
  return path
    .slice(1)
    .split("/")
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function getAtPath(target: unknown, path: string): unknown {
  const segments = decodePointer(path);
  let current: any = target;
  for (const segment of segments) {
    if (current == null) return undefined;
    current = current[segment];
  }
  return current;
}

function setAtPath(target: unknown, path: string, value: unknown): void {
  const segments = decodePointer(path);
  if (segments.length === 0) return;
  const last = segments[segments.length - 1];
  let current: any = target;
  for (const segment of segments.slice(0, -1)) {
    if (current[segment] == null) {
      current[segment] = {};
    }
    current = current[segment];
  }

  if (Array.isArray(current)) {
    if (last === "-") {
      current.push(value);
      return;
    }
    const index = Number(last);
    if (!Number.isNaN(index)) {
      current[index] = value;
      return;
    }
  }

  current[last] = value;
}

function removeAtPath(target: unknown, path: string): void {
  const segments = decodePointer(path);
  if (segments.length === 0) return;
  const last = segments[segments.length - 1];
  let current: any = target;
  for (const segment of segments.slice(0, -1)) {
    if (current == null) return;
    current = current[segment];
  }
  if (Array.isArray(current)) {
    const index = Number(last);
    if (!Number.isNaN(index)) {
      current.splice(index, 1);
    }
    return;
  }
  if (current && Object.prototype.hasOwnProperty.call(current, last)) {
    delete current[last];
  }
}

function isEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function applyJsonPatch<T>(input: T, patch: JsonPatchOperation[]): T {
  const next = JSON.parse(JSON.stringify(input)) as T;
  for (const op of patch) {
    if (op.op === "test") {
      const current = getAtPath(next, op.path);
      if (!isEqual(current, op.value)) {
        throw new Error("JSON Patch test failed");
      }
      continue;
    }

    if (op.op === "add") {
      setAtPath(next, op.path, op.value);
      continue;
    }

    if (op.op === "replace") {
      setAtPath(next, op.path, op.value);
      continue;
    }

    if (op.op === "remove") {
      removeAtPath(next, op.path);
      continue;
    }

    if (op.op === "move") {
      const value = getAtPath(next, op.from);
      removeAtPath(next, op.from);
      setAtPath(next, op.path, value);
      continue;
    }

    if (op.op === "copy") {
      const value = getAtPath(next, op.from);
      setAtPath(next, op.path, value);
    }
  }

  return next;
}

export function compileArtifactOp(
  envelope: ArtifactEnvelopeByType,
  op: ArtifactOp
): ArtifactPatch {
  const baseRev = envelope.rev;
  const patch: JsonPatchOperation[] = [{ op: "test", path: "/rev", value: baseRev }];

  switch (op.type) {
    case "diagram.edge.add": {
      const edgeId = op.edge.edgeId;
      patch.push({
        op: "add",
        path: `/data/edgesById/${edgeId}`,
        value: {
          edgeId,
          source: op.edge.source,
          target: op.edge.target,
          type: op.edge.type ?? "relationshipEdge",
          data: op.edge.data ?? {},
        },
      });
      patch.push({ op: "add", path: "/data/edgeOrder/-", value: edgeId });
      break;
    }
    case "diagram.edge.update": {
      patch.push({
        op: "replace",
        path: `/data/edgesById/${op.edgeId}`,
        value: {
          ...(getAtPath(envelope, `/data/edgesById/${op.edgeId}`) as Record<string, unknown>),
          ...op.updates,
        },
      });
      break;
    }
    case "diagram.node.upsert": {
      const nodeId = op.node.nodeId;
      patch.push({
        op: "add",
        path: `/data/nodesById/${nodeId}`,
        value: op.node,
      });
      patch.push({ op: "add", path: "/data/nodeOrder/-", value: nodeId });
      break;
    }
    case "diagram.node.move": {
      patch.push({
        op: "replace",
        path: `/data/nodesById/${op.nodeId}/position`,
        value: op.position,
      });
      break;
    }
    case "table.row.reorder": {
      patch.push({
        op: "replace",
        path: "/data/rowOrder",
        value: op.rowOrder,
      });
      break;
    }
    case "table.row.add": {
      patch.push({
        op: "add",
        path: `/data/rowsById/${op.row.rowId}`,
        value: op.row,
      });
      patch.push({ op: "add", path: "/data/rowOrder/-", value: op.row.rowId });
      break;
    }
    case "table.cell.update": {
      patch.push({
        op: "replace",
        path: `/data/rowsById/${op.rowId}/cells/${op.columnId}`,
        value: op.value,
      });
      break;
    }
    case "table.rows.remove": {
      const currentOrder = (envelope.data as { rowOrder?: string[] }).rowOrder ?? [];
      const nextOrder = currentOrder.filter((rowId) => !op.rowIds.includes(rowId));
      for (const rowId of op.rowIds) {
        patch.push({ op: "remove", path: `/data/rowsById/${rowId}` });
      }
      patch.push({ op: "replace", path: "/data/rowOrder", value: nextOrder });
      break;
    }
    case "timeline.item.upsert": {
      const itemId = op.item.itemId;
      patch.push({
        op: "add",
        path: `/data/itemsById/${itemId}`,
        value: op.item,
      });
      patch.push({ op: "add", path: "/data/itemOrder/-", value: itemId });
      break;
    }
    case "timeline.item.update": {
      patch.push({
        op: "replace",
        path: `/data/itemsById/${op.itemId}`,
        value: {
          ...(getAtPath(envelope, `/data/itemsById/${op.itemId}`) as Record<string, unknown>),
          ...op.updates,
        },
      });
      break;
    }
    case "outline.item.move": {
      const parentKey = op.newParentId ?? "root";
      const childrenByParent = (envelope.data as { childrenByParentId?: Record<string, string[]> })
        .childrenByParentId ?? {};
      for (const [parentId, children] of Object.entries(childrenByParent)) {
        const index = children.indexOf(op.itemId);
        if (index >= 0) {
          patch.push({
            op: "remove",
            path: `/data/childrenByParentId/${parentId}/${index}`,
          });
          break;
        }
      }
      patch.push({
        op: "add",
        path: `/data/childrenByParentId/${parentKey}/${op.newIndex}`,
        value: op.itemId,
      });
      break;
    }
    case "prose.block.replace": {
      patch.push({
        op: "replace",
        path: `/data/blocksById/${op.blockId}/markdown`,
        value: op.markdown,
      });
      break;
    }
    default: {
      const exhaustiveCheck: never = op;
      throw new Error(`Unsupported op: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }

  patch.push({ op: "replace", path: "/rev", value: baseRev + 1 });

  return {
    artifactId: envelope.artifactId,
    baseRev,
    op,
    patch,
  };
}

export function applyArtifactPatch(
  envelope: ArtifactEnvelopeByType,
  patch: ArtifactPatch
): { next: ArtifactEnvelopeByType; logEntry: ArtifactOpLogEntry } {
  const next = applyJsonPatch(envelope, patch.patch) as ArtifactEnvelopeByType;
  const now = Date.now();

  return {
    next,
    logEntry: {
      id: `op-${now}-${Math.random().toString(36).slice(2, 8)}`,
      artifactId: patch.artifactId,
      baseRev: patch.baseRev,
      nextRev: next.rev,
      op: patch.op,
      patch: patch.patch,
      createdAt: now,
    },
  };
}
