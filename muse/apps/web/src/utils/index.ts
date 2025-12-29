// Utility functions
export { simpleHash } from "./hash";

// Entity configuration utilities
export {
  getEntityIconComponent,
  getIconByName,
  getEntityTypeButtons,
  type EntityTypeButtonConfig,
  // Re-exports from @mythos/core
  ENTITY_TYPE_CONFIG,
  ENTITY_TYPES,
  ENTITY_HEX_COLORS,
  getEntityIcon,
  getEntityLabel,
  getEntityHexColor,
  type EntityIconName,
} from "./entityConfig";

// DB <-> Core type mappers (re-exported from @mythos/db)
export {
  mapDbProjectToProject,
  mapDbDocumentToDocument,
  mapDbEntityToEntity,
  mapCoreEntityToDbInsert,
  mapCoreEntityToDbUpdate,
  type DbProject,
  type DbDocument,
  type DbEntity,
  type DbEntityInsert,
  type DbEntityUpdate,
} from "@mythos/db";
