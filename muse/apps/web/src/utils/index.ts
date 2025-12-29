// Utility functions
export { simpleHash } from "./hash";

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
