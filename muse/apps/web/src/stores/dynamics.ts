import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Interaction, InteractionType } from "@mythos/core";

// Dynamics state for tracking causal interactions
interface DynamicsState {
  interactions: Interaction[];
  isLoading: boolean;
  error: string | null;
  selectedInteractionId: string | null;
}

interface DynamicsActions {
  // CRUD actions
  setInteractions: (interactions: Interaction[]) => void;
  addInteraction: (interaction: Interaction) => void;
  updateInteraction: (
    id: string,
    updates: Partial<Omit<Interaction, "id" | "createdAt">>
  ) => void;
  removeInteraction: (id: string) => void;

  // State management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedInteraction: (id: string | null) => void;

  // Bulk operations
  clearInteractions: () => void;
}

interface DynamicsStore extends DynamicsState, DynamicsActions {}

export const useDynamicsStore = create<DynamicsStore>()(
  immer((set) => ({
    // Initial state
    interactions: [],
    isLoading: false,
    error: null,
    selectedInteractionId: null,

    // CRUD actions
    setInteractions: (interactions) =>
      set((state) => {
        state.interactions = interactions;
      }),

    addInteraction: (interaction) =>
      set((state) => {
        state.interactions.push(interaction);
      }),

    updateInteraction: (id, updates) =>
      set((state) => {
        const idx = state.interactions.findIndex((i) => i.id === id);
        if (idx !== -1) {
          Object.assign(state.interactions[idx], updates);
        }
      }),

    removeInteraction: (id) =>
      set((state) => {
        state.interactions = state.interactions.filter((i) => i.id !== id);
      }),

    // State management
    setLoading: (loading) =>
      set((state) => {
        state.isLoading = loading;
      }),

    setError: (error) =>
      set((state) => {
        state.error = error;
      }),

    setSelectedInteraction: (id) =>
      set((state) => {
        state.selectedInteractionId = id;
      }),

    // Bulk operations
    clearInteractions: () =>
      set((state) => {
        state.interactions = [];
      }),
  }))
);

// Selectors
export const useInteractions = () =>
  useDynamicsStore((state) => state.interactions);

export const useHiddenInteractions = () =>
  useDynamicsStore((state) =>
    state.interactions.filter((i) => i.type === "hidden")
  );

export const useHostileInteractions = () =>
  useDynamicsStore((state) =>
    state.interactions.filter((i) => i.type === "hostile")
  );

export const useInteractionsByType = (type: InteractionType) =>
  useDynamicsStore((state) =>
    state.interactions.filter((i) => i.type === type)
  );

export const useEntityInteractions = (entityId: string) =>
  useDynamicsStore((state) =>
    state.interactions.filter(
      (i) => i.source === entityId || i.target === entityId
    )
  );

export const useSelectedInteraction = () =>
  useDynamicsStore((state) => {
    if (!state.selectedInteractionId) return null;
    return (
      state.interactions.find((i) => i.id === state.selectedInteractionId) ??
      null
    );
  });

export const useInteractionCount = () =>
  useDynamicsStore((state) => state.interactions.length);

export const useInteractionsByScene = (sceneMarker: string) =>
  useDynamicsStore((state) =>
    state.interactions.filter((i) => i.time === sceneMarker)
  );

// Helper to convert store interactions to logical flow strings
export const useLogicalFlow = () =>
  useDynamicsStore((state) =>
    state.interactions
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((i) => {
        const base = `${i.source} -> ${i.action} -> ${i.target}`;
        return i.effect ? `${base} [${i.effect}]` : base;
      })
  );
