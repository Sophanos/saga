// Utility functions
export { simpleHash } from "./hash";

// DB <-> Core type mappers
export {
  mapDbProjectToProject,
  mapDbDocumentToDocument,
  mapDbEntityToEntity,
  mapCoreEntityToDbInsert,
  mapCoreEntityToDbUpdate,
} from "./dbMappers";

// Re-export DB types for convenience
export type {
  DbProject,
  DbDocument,
  DbEntity,
  DbEntityInsert,
  DbEntityUpdate,
} from "./dbMappers";
