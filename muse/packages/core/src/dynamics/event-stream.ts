import type { Interaction, EventStreamSnapshot } from "./types";

/**
 * EventStream manages causal interactions in scenes.
 * Tracks how entities interact and allows querying causal chains.
 */
export class EventStream {
  private interactions: Map<string, Interaction> = new Map();

  constructor(initialInteractions: Interaction[] = []) {
    initialInteractions.forEach((interaction) => {
      this.interactions.set(interaction.id, interaction);
    });
  }

  /**
   * Add a new interaction to the stream
   */
  addInteraction(interaction: Interaction): void {
    this.interactions.set(interaction.id, interaction);
  }

  /**
   * Remove an interaction by id
   */
  removeInteraction(id: string): boolean {
    return this.interactions.delete(id);
  }

  /**
   * Get an interaction by id
   */
  getInteraction(id: string): Interaction | undefined {
    return this.interactions.get(id);
  }

  /**
   * Get all interactions involving an entity (as source or target)
   */
  getByEntity(entityId: string): Interaction[] {
    const result: Interaction[] = [];
    this.interactions.forEach((interaction) => {
      if (interaction.source === entityId || interaction.target === entityId) {
        result.push(interaction);
      }
    });
    return result.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /**
   * Get all interactions as an array
   */
  getAllInteractions(): Interaction[] {
    return Array.from(this.interactions.values()).sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
  }

  /**
   * Get causal chain starting from an interaction
   * Follows target -> source relationships to find connected events
   */
  getChain(startId: string, depth: number = 5): Interaction[] {
    const chain: Interaction[] = [];
    const visited = new Set<string>();

    const traverse = (id: string, currentDepth: number) => {
      if (currentDepth > depth || visited.has(id)) return;
      visited.add(id);

      const interaction = this.interactions.get(id);
      if (!interaction) return;

      chain.push(interaction);

      // Find interactions where the current target becomes a source
      // This follows causal chains: A kills B -> B drops item -> C picks up item
      this.interactions.forEach((otherInteraction) => {
        if (
          !visited.has(otherInteraction.id) &&
          (otherInteraction.source === interaction.target ||
            otherInteraction.target === interaction.source)
        ) {
          // Check if temporally connected (same or adjacent scene)
          if (this.isTemporallyClose(interaction, otherInteraction)) {
            traverse(otherInteraction.id, currentDepth + 1);
          }
        }
      });
    };

    traverse(startId, 0);
    return chain.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /**
   * Check if two interactions are temporally close
   */
  private isTemporallyClose(a: Interaction, b: Interaction): boolean {
    // Parse scene markers like "Sc 1", "Sc 2"
    const parseScene = (time: string): number => {
      const match = time.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };

    const sceneA = parseScene(a.time);
    const sceneB = parseScene(b.time);

    // Consider interactions within 2 scenes as temporally close
    return Math.abs(sceneA - sceneB) <= 2;
  }

  /**
   * Get all hidden interactions
   */
  getHiddenInteractions(): Interaction[] {
    const result: Interaction[] = [];
    this.interactions.forEach((interaction) => {
      if (interaction.type === "hidden") {
        result.push(interaction);
      }
    });
    return result.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /**
   * Get interactions by type
   */
  getByType(type: Interaction["type"]): Interaction[] {
    const result: Interaction[] = [];
    this.interactions.forEach((interaction) => {
      if (interaction.type === type) {
        result.push(interaction);
      }
    });
    return result.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /**
   * Get interactions by document
   */
  getByDocument(documentId: string): Interaction[] {
    const result: Interaction[] = [];
    this.interactions.forEach((interaction) => {
      if (interaction.documentId === documentId) {
        result.push(interaction);
      }
    });
    return result.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /**
   * Convert to logical flow representation
   * Returns array of "Source -> Action -> Target" strings
   */
  toLogicalFlow(): string[] {
    const sorted = Array.from(this.interactions.values()).sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    return sorted.map((interaction) => {
      const base = `${interaction.source} -> ${interaction.action} -> ${interaction.target}`;
      const suffix = interaction.effect ? ` [${interaction.effect}]` : "";
      return base + suffix;
    });
  }

  /**
   * Get a text summary of the event stream
   */
  toSummary(): string {
    const flows = this.toLogicalFlow();
    if (flows.length === 0) {
      return "No interactions recorded.";
    }
    return flows.join("\n");
  }

  /**
   * Serialize to JSON
   */
  toJSON(): EventStreamSnapshot {
    return {
      interactions: Array.from(this.interactions.values()),
    };
  }

  /**
   * Create EventStream from JSON
   */
  static fromJSON(data: EventStreamSnapshot): EventStream {
    // Ensure dates are properly converted
    const interactions = data.interactions.map((interaction) => ({
      ...interaction,
      createdAt:
        typeof interaction.createdAt === "string"
          ? new Date(interaction.createdAt)
          : interaction.createdAt,
    }));
    return new EventStream(interactions);
  }

  /**
   * Get the count of interactions
   */
  get count(): number {
    return this.interactions.size;
  }

  /**
   * Clear all interactions
   */
  clear(): void {
    this.interactions.clear();
  }

  /**
   * Update an existing interaction
   */
  updateInteraction(
    id: string,
    updates: Partial<Omit<Interaction, "id" | "createdAt">>
  ): Interaction | undefined {
    const existing = this.interactions.get(id);
    if (!existing) return undefined;

    const updated: Interaction = {
      ...existing,
      ...updates,
    };
    this.interactions.set(id, updated);
    return updated;
  }
}
