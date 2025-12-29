/**
 * Centralized DB <-> Core type mappers
 */

// Entity mappers
export {
  mapDbEntityToEntity,
  mapCoreEntityToDbInsert,
  mapCoreEntityToDbUpdate,
  mapCoreEntityToDbFullUpdate,
  type DbEntity,
  type DbEntityInsert,
  type DbEntityUpdate,
} from "./entity";

// Document mappers
export {
  mapDbDocumentToDocument,
  type DbDocument,
} from "./document";

// Project mappers
export {
  mapDbProjectToProject,
  type DbProject,
} from "./project";

// Relationship mappers
export {
  mapDbRelationshipToRelationship,
  mapCoreRelationshipToDbInsert,
  mapCoreRelationshipToDbFullUpdate,
  type DbRelationship,
  type DbRelationshipInsert,
  type DbRelationshipUpdate,
} from "./relationship";

// Activity mappers
export {
  mapDbActivityToActivityLogEntry,
  mapDbActionToActivityType,
  mapActivityTypeToAction,
  type ActivityWithActor,
} from "./activity";
