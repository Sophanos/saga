import { useCallback, useEffect } from "react";
import { useMythosStore, useModal } from "../../stores";
import { useEntityPersistence } from "../../hooks/useEntityPersistence";
import { useRelationshipPersistence } from "../../hooks/useRelationshipPersistence";
import { BillingSettings } from "../settings/BillingSettings";
import { SettingsModal } from "../settings/SettingsModal";
import { ExportModal } from "./ExportModal";
import { ImportModal } from "./ImportModal";
import { EntityFormModal, type EntityFormData } from "./EntityFormModal";
import {
  RelationshipFormModal,
  type RelationshipFormData,
} from "./RelationshipFormModal";
import { InviteMemberModal } from "../collaboration/InviteMemberModal";
import type { Entity, Relationship } from "@mythos/core";
import { buildEntity, buildRelationship, getTypeSpecificUpdates } from "@mythos/core";

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

  const {
    createEntity,
    updateEntity: persistUpdateEntity,
    isLoading: isEntitySaving,
    error: entitySaveError,
    clearError: clearEntityError,
  } = useEntityPersistence();

  const {
    createRelationship,
    updateRelationship,
    isLoading: isRelationshipSaving,
    error: relationshipSaveError,
    clearError: clearRelationshipError,
  } = useRelationshipPersistence();

  // Handle entity form save
  const handleEntitySave = useCallback(
    async (data: EntityFormData) => {
      if (!project) return;

      const now = new Date();
      clearEntityError();

      if (modal?.type === "entityForm") {
        if (modal.mode === "create") {
          // Build the entity using the factory
          const entity = buildEntity(data, { createdAt: now, updatedAt: now });

          // Persist to database
          const result = await createEntity(entity, project.id);
          if (result.data) {
            addEntity(result.data);
          }
          if (result.error) {
            return;
          }
        } else if (modal.mode === "edit" && modal.entityId) {
          // Build partial updates using the factory
          const updates = getTypeSpecificUpdates(data);

          // Persist to database
          const result = await persistUpdateEntity(modal.entityId, updates);
          if (result.data) {
            updateEntity(modal.entityId, updates);
          }
          if (result.error) {
            return;
          }
        }
      }

      closeModal();
    },
    [
      modal,
      project,
      createEntity,
      persistUpdateEntity,
      addEntity,
      updateEntity,
      closeModal,
      clearEntityError,
    ]
  );

  const handleEntityClose = useCallback(() => {
    clearEntityError();
    closeModal();
  }, [clearEntityError, closeModal]);

  const handleRelationshipSave = useCallback(
    async (data: RelationshipFormData) => {
      if (!project) return;

      clearRelationshipError();

      if (modal?.type === "relationshipForm") {
        if (modal.mode === "create") {
          const relationship = buildRelationship({
            sourceId: data.sourceId,
            targetId: data.targetId,
            type: data.type,
            bidirectional: data.bidirectional,
            strength: data.strength,
            metadata: data.metadata,
            notes: data.notes,
          });

          const result = await createRelationship(relationship, project.id);
          if (result.error) {
            return;
          }
        } else if (modal.mode === "edit" && modal.relationshipId) {
          const updates: Partial<Relationship> = {
            type: data.type,
            bidirectional: data.bidirectional,
            strength: data.strength,
            metadata: data.metadata,
            notes: data.notes,
          };

          const result = await updateRelationship(modal.relationshipId, updates);
          if (result.error) {
            return;
          }
        }
      }

      closeModal();
    },
    [
      modal,
      project,
      createRelationship,
      updateRelationship,
      closeModal,
      clearRelationshipError,
    ]
  );

  const handleRelationshipClose = useCallback(() => {
    clearRelationshipError();
    closeModal();
  }, [clearRelationshipError, closeModal]);

  useEffect(() => {
    if (modal?.type === "entityForm") {
      clearEntityError();
    }
    if (modal?.type === "relationshipForm") {
      clearRelationshipError();
    }
  }, [
    modal?.type,
    modal?.entityId,
    modal?.relationshipId,
    modal?.mode,
    clearEntityError,
    clearRelationshipError,
  ]);

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
      return <SettingsModal isOpen={true} onClose={closeModal} initialSection="profile" />;

    case "billing":
      return <BillingSettings isOpen={true} onClose={closeModal} />;

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
          isSaving={isEntitySaving}
          saveError={entitySaveError}
          onClose={handleEntityClose}
          onSave={handleEntitySave}
        />
      );

    case "relationshipForm":
      return (
        <RelationshipFormModal
          isOpen={true}
          mode={modal.mode}
          relationshipId={modal.relationshipId}
          initial={modal.initial}
          isSaving={isRelationshipSaving}
          saveError={relationshipSaveError}
          onClose={handleRelationshipClose}
          onSave={handleRelationshipSave}
        />
      );

    case "inviteMember":
      return <InviteMemberModal isOpen={true} onClose={closeModal} />;

    case "profile":
      return <SettingsModal isOpen={true} onClose={closeModal} initialSection="profile" />;

    default:
      return null;
  }
}
