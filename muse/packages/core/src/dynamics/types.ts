export type InteractionType = "neutral" | "hostile" | "hidden" | "passive";

export interface Interaction {
  id: string;
  source: string;      // entityId
  action: string;      // verb like "ENTERS", "EQUIPS", "KILLS"
  target: string;      // entityId
  type: InteractionType;
  time: string;        // scene marker like "Sc 1"
  effect?: string;     // mechanical effect like "-2 WIS"
  note?: string;       // hidden info like "Player unaware"
  documentId?: string;
  createdAt: Date;
}

export interface EventStreamSnapshot {
  interactions: Interaction[];
}
