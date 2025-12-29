import { useCallback } from "react";
import { useMythosStore, useModal } from "../../stores";
import { useEntityPersistence } from "../../hooks/useEntityPersistence";
import { ApiKeySettings } from "../settings/ApiKeySettings";
import { ExportModal } from "./ExportModal";
import { ImportModal } from "./ImportModal";
import { EntityFormModal, type EntityFormData } from "./EntityFormModal";
import type { Entity, Character, Location, Item, MagicSystem, Faction } from "@mythos/core";

/**
 * ModalHost renders the currently open modal based on store state.
 * This centralizes modal rendering and allows commands/actions to open modals
 * without prop drilling.
 */
export function ModalHost() {
  const modal = useModal();
  const closeModal = useMythosStore((s) => s.closeModal);
  const entities = useMythosStore((s) => s.world.entities);
  const project = useMythosStore((s) => s.project.currentProject);
  const addEntity = useMythosStore((s) => s.addEntity);
  const updateEntity = useMythosStore((s) => s.updateEntity);

  const { createEntity, updateEntity: persistUpdateEntity } = useEntityPersistence();

  // Handle entity form save
  const handleEntitySave = useCallback(
    async (data: EntityFormData) => {
      if (!project) return;

      const now = new Date();

      if (modal?.type === "entityForm") {
        if (modal.mode === "create") {
          // Build the entity based on type
          const baseEntity = {
            id: crypto.randomUUID(),
            name: data.name,
            type: data.type,
            aliases: data.aliases,
            notes: data.notes,
            properties: {},
            createdAt: now,
            updatedAt: now,
            mentions: [],
          };

          let entity: Entity;

          switch (data.type) {
            case "character": {
              const char: Character = {
                ...baseEntity,
                type: "character",
                archetype: data.archetype,
                traits: data.traits ?? [],
                status: {},
                visualDescription: {},
                backstory: data.backstory,
                goals: data.goals ?? [],
                fears: data.fears ?? [],
                voiceNotes: data.voiceNotes,
              };
              entity = char;
              break;
            }
            case "location": {
              const loc: Location = {
                ...baseEntity,
                type: "location",
                parentLocation: data.parentLocation,
                climate: data.climate,
                atmosphere: data.atmosphere,
              };
              entity = loc;
              break;
            }
            case "item": {
              const item: Item = {
                ...baseEntity,
                type: "item",
                category: data.category ?? "other",
                rarity: data.rarity,
                abilities: data.abilities ?? [],
              };
              entity = item;
              break;
            }
            case "magic_system": {
              const magic: MagicSystem = {
                ...baseEntity,
                type: "magic_system",
                rules: data.rules ?? [],
                limitations: data.limitations ?? [],
                costs: data.costs ?? [],
              };
              entity = magic;
              break;
            }
            case "faction": {
              const faction: Faction = {
                ...baseEntity,
                type: "faction",
                leader: data.leader,
                headquarters: data.headquarters,
                goals: data.factionGoals ?? [],
                rivals: data.rivals ?? [],
                allies: data.allies ?? [],
              };
              entity = faction;
              break;
            }
            default: {
              entity = baseEntity as Entity;
            }
          }

          // Persist to database
          const result = await createEntity(entity, project.id);
          if (result.data) {
            addEntity(result.data);
          }
        } else if (modal.mode === "edit" && modal.entityId) {
          // Build partial updates
          const updates: Partial<Entity> = {
            name: data.name,
            aliases: data.aliases,
            notes: data.notes,
            updatedAt: now,
          };

          // Add type-specific fields
          if (data.type === "character") {
            Object.assign(updates, {
              archetype: data.archetype,
              traits: data.traits,
              backstory: data.backstory,
              goals: data.goals,
              fears: data.fears,
              voiceNotes: data.voiceNotes,
            });
          } else if (data.type === "location") {
            Object.assign(updates, {
              parentLocation: data.parentLocation,
              climate: data.climate,
              atmosphere: data.atmosphere,
            });
          } else if (data.type === "item") {
            Object.assign(updates, {
              category: data.category,
              rarity: data.rarity,
              abilities: data.abilities,
            });
          } else if (data.type === "magic_system") {
            Object.assign(updates, {
              rules: data.rules,
              limitations: data.limitations,
              costs: data.costs,
            });
          } else if (data.type === "faction") {
            Object.assign(updates, {
              leader: data.leader,
              headquarters: data.headquarters,
              goals: data.factionGoals,
              rivals: data.rivals,
              allies: data.allies,
            });
          }

          // Persist to database
          const result = await persistUpdateEntity(modal.entityId, updates);
          if (result.data) {
            updateEntity(modal.entityId, updates);
          }
        }
      }

      closeModal();
    },
    [modal, project, createEntity, persistUpdateEntity, addEntity, updateEntity, closeModal]
  );

  // Get entity for edit mode
  const getEntityForEdit = useCallback((): Entity | undefined => {
    if (modal?.type === "entityForm" && modal.mode === "edit" && modal.entityId) {
      return entities.get(modal.entityId);
    }
    return undefined;
  }, [modal, entities]);

  if (!modal) return null;

  switch (modal.type) {
    case "settings":
      return <ApiKeySettings isOpen={true} onClose={closeModal} />;

    case "import":
      return <ImportModal isOpen={true} onClose={closeModal} />;

    case "export":
      return <ExportModal isOpen={true} onClose={closeModal} />;

    case "entityForm":
      return (
        <EntityFormModal
          isOpen={true}
          mode={modal.mode}
          entityType={modal.entityType}
          entity={getEntityForEdit()}
          onClose={closeModal}
          onSave={handleEntitySave}
        />
      );

    default:
      return null;
  }
}
