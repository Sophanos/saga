import { nanoid } from "nanoid";
import type {
  Entity,
  Relationship,
  RelationType,
  Character,
} from "../entities/types";

// Conflict detected by the project graph
export interface Conflict {
  id: string;
  type:
    | "genealogy"
    | "timeline"
    | "location"
    | "relationship"
    | "power_scaling"
    | "visual";
  severity: "info" | "warning" | "error";
  message: string;
  entities: string[];
  suggestion?: string;
}

// Project Graph implementation
export class ProjectGraph {
  private nodes: Map<string, Entity> = new Map();
  private edges: Map<string, Relationship> = new Map();
  private adjacency: Map<string, Set<string>> = new Map();

  constructor(
    entities: Entity[] = [],
    relationships: Relationship[] = []
  ) {
    entities.forEach((e) => this.addEntity(e));
    relationships.forEach((r) => this.addRelationship(r));
  }

  // Entity operations
  addEntity(entity: Entity): void {
    this.nodes.set(entity.id, entity);
    if (!this.adjacency.has(entity.id)) {
      this.adjacency.set(entity.id, new Set());
    }
  }

  getEntity(id: string): Entity | undefined {
    return this.nodes.get(id);
  }

  updateEntity(id: string, updates: Partial<Entity>): Entity | undefined {
    const entity = this.nodes.get(id);
    if (!entity) return undefined;

    const updated = {
      ...entity,
      ...updates,
      updatedAt: new Date(),
    } as Entity;
    this.nodes.set(id, updated);
    return updated;
  }

  removeEntity(id: string): boolean {
    // Remove all relationships involving this entity
    this.edges.forEach((rel, relId) => {
      if (rel.sourceId === id || rel.targetId === id) {
        this.edges.delete(relId);
      }
    });

    // Remove from adjacency
    this.adjacency.delete(id);
    this.adjacency.forEach((neighbors) => neighbors.delete(id));

    return this.nodes.delete(id);
  }

  // Relationship operations
  addRelationship(relationship: Relationship): void {
    this.edges.set(relationship.id, relationship);

    // Update adjacency
    if (!this.adjacency.has(relationship.sourceId)) {
      this.adjacency.set(relationship.sourceId, new Set());
    }
    this.adjacency.get(relationship.sourceId)!.add(relationship.targetId);

    if (relationship.bidirectional) {
      if (!this.adjacency.has(relationship.targetId)) {
        this.adjacency.set(relationship.targetId, new Set());
      }
      this.adjacency.get(relationship.targetId)!.add(relationship.sourceId);
    }
  }

  createRelationship(
    sourceId: string,
    targetId: string,
    type: RelationType,
    options: Partial<Omit<Relationship, "id" | "sourceId" | "targetId" | "type" | "createdAt">> = {}
  ): Relationship {
    const relationship: Relationship = {
      id: nanoid(),
      sourceId,
      targetId,
      type,
      bidirectional: options.bidirectional ?? false,
      strength: options.strength,
      metadata: options.metadata,
      notes: options.notes,
      createdAt: new Date(),
    };
    this.addRelationship(relationship);
    return relationship;
  }

  getRelationship(id: string): Relationship | undefined {
    return this.edges.get(id);
  }

  getRelationshipsBetween(
    entityA: string,
    entityB: string
  ): Relationship[] {
    const result: Relationship[] = [];
    this.edges.forEach((rel) => {
      if (
        (rel.sourceId === entityA && rel.targetId === entityB) ||
        (rel.sourceId === entityB && rel.targetId === entityA)
      ) {
        result.push(rel);
      }
    });
    return result;
  }

  // Query operations
  getRelated(entityId: string, depth: number = 1): Entity[] {
    const visited = new Set<string>();
    const result: Entity[] = [];

    const traverse = (id: string, currentDepth: number) => {
      if (currentDepth > depth || visited.has(id)) return;
      visited.add(id);

      const neighbors = this.adjacency.get(id) || new Set();
      neighbors.forEach((neighborId) => {
        const entity = this.nodes.get(neighborId);
        if (entity && !visited.has(neighborId)) {
          result.push(entity);
          traverse(neighborId, currentDepth + 1);
        }
      });
    };

    traverse(entityId, 0);
    return result;
  }

  getEntitiesByType(type: Entity["type"]): Entity[] {
    const result: Entity[] = [];
    this.nodes.forEach((entity) => {
      if (entity.type === type) {
        result.push(entity);
      }
    });
    return result;
  }

  getCharacters(): Character[] {
    return this.getEntitiesByType("character") as Character[];
  }

  findByName(name: string): Entity[] {
    const lowerName = name.toLowerCase();
    const result: Entity[] = [];
    this.nodes.forEach((entity) => {
      if (
        entity.name.toLowerCase().includes(lowerName) ||
        entity.aliases.some((a) => a.toLowerCase().includes(lowerName))
      ) {
        result.push(entity);
      }
    });
    return result;
  }

  // Conflict detection
  detectConflicts(): Conflict[] {
    const conflicts: Conflict[] = [];

    // Check for genealogy conflicts (incest warnings)
    this.detectGenealogyConflicts(conflicts);

    // Check for relationship conflicts
    this.detectRelationshipConflicts(conflicts);

    return conflicts;
  }

  private detectGenealogyConflicts(conflicts: Conflict[]): void {
    const marriedPairs: Array<[string, string]> = [];

    this.edges.forEach((rel) => {
      if (rel.type === "married_to") {
        marriedPairs.push([rel.sourceId, rel.targetId]);
      }
    });

    marriedPairs.forEach(([a, b]) => {
      const relationship = this.findFamilyRelation(a, b);
      if (relationship) {
        conflicts.push({
          id: nanoid(),
          type: "genealogy",
          severity: "warning",
          message: `Incest Warning: ${this.getEntity(a)?.name} and ${this.getEntity(b)?.name} are ${relationship}`,
          entities: [a, b],
          suggestion: "Review family tree or make this intentional plot point",
        });
      }
    });
  }

  private findFamilyRelation(a: string, b: string): string | null {
    // Check for parent/child
    const familyRelations = ["parent_of", "child_of", "sibling_of"];
    const checked = new Set<string>();
    const queue: Array<{ id: string; path: string[]; relation: string }> = [
      { id: a, path: [], relation: "" },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.path.length > 4) continue; // Limit search depth

      if (current.id === b && current.path.length > 0) {
        return this.describeRelation(current.path);
      }

      if (checked.has(current.id)) continue;
      checked.add(current.id);

      this.edges.forEach((rel) => {
        if (!familyRelations.includes(rel.type)) return;

        if (rel.sourceId === current.id) {
          queue.push({
            id: rel.targetId,
            path: [...current.path, rel.type],
            relation: rel.type,
          });
        }
        if (rel.targetId === current.id || rel.bidirectional) {
          queue.push({
            id: rel.sourceId,
            path: [...current.path, `reverse_${rel.type}`],
            relation: rel.type,
          });
        }
      });
    }

    return null;
  }

  private describeRelation(path: string[]): string {
    if (path.length === 1) {
      if (path[0] === "sibling_of") return "siblings";
      if (path[0] === "parent_of") return "parent and child";
      if (path[0] === "child_of") return "child and parent";
    }
    if (path.length === 2) {
      if (path.every((p) => p.includes("parent"))) return "grandparent/grandchild";
      if (path.every((p) => p.includes("sibling") || p.includes("child"))) {
        return "1st cousins";
      }
    }
    return `related (${path.length} degrees)`;
  }

  private detectRelationshipConflicts(conflicts: Conflict[]): void {
    // Check for contradictory relationships
    this.edges.forEach((rel) => {
      if (rel.type === "loves") {
        const hatesRel = Array.from(this.edges.values()).find(
          (r) =>
            r.type === "hates" &&
            r.sourceId === rel.sourceId &&
            r.targetId === rel.targetId
        );
        if (hatesRel) {
          conflicts.push({
            id: nanoid(),
            type: "relationship",
            severity: "info",
            message: `Complex relationship: ${this.getEntity(rel.sourceId)?.name} both loves and hates ${this.getEntity(rel.targetId)?.name}`,
            entities: [rel.sourceId, rel.targetId],
            suggestion: "This could be intentional complexity or a conflict to resolve",
          });
        }
      }
    });
  }

  // Serialization
  toJSON(): { entities: Entity[]; relationships: Relationship[] } {
    return {
      entities: Array.from(this.nodes.values()),
      relationships: Array.from(this.edges.values()),
    };
  }

  static fromJSON(data: {
    entities: Entity[];
    relationships: Relationship[];
  }): ProjectGraph {
    return new ProjectGraph(data.entities, data.relationships);
  }

  // Stats
  get entityCount(): number {
    return this.nodes.size;
  }

  get relationshipCount(): number {
    return this.edges.size;
  }
}

export type { Entity, Relationship };
