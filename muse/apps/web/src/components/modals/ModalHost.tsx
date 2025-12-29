import { useCallback } from "react";
import { useMythosStore, useModal } from "../../stores";
import { useEntityPersistence } from "../../hooks/useEntityPersistence";
import { ApiKeySettings } from "../settings/ApiKeySettings";
import { ExportModal } from "./ExportModal";
import { ImportModal } from "./ImportModal";
import { EntityFormModal, type EntityFormData } from "./EntityFormModal";
import { InviteMemberModal } from "../collaboration/InviteMemberModal";
import type { Entity } from "@mythos/core";
import { buildEntity, getTypeSpecificUpdates } from "@mythos/core";

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
          // Build the entity using the factory
          const entity = buildEntity(data, { createdAt: now, updatedAt: now });

          // Persist to database
          const result = await createEntity(entity, project.id);
          if (result.data) {
            addEntity(result.data);
          }
        } else if (modal.mode === "edit" && modal.entityId) {
          // Build partial updates using the factory
          const updates = getTypeSpecificUpdates(data);

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

    case "inviteMember":
      return <InviteMemberModal isOpen={true} onClose={closeModal} />;

    default:
      return null;
  }
}
