/**
 * Client Tool Executors Index
 */

// Core entity/relationship tools
export { createEntityExecutor, type CreateEntityArgs, type CreateEntityResult } from "./createEntity";
export { updateEntityExecutor, type UpdateEntityArgs, type UpdateEntityResult } from "./updateEntity";
export { deleteEntityExecutor, type DeleteEntityArgs, type DeleteEntityResult } from "./deleteEntity";
export { createRelationshipExecutor, type CreateRelationshipArgs, type CreateRelationshipResult } from "./createRelationship";
export { updateRelationshipExecutor, type UpdateRelationshipArgs, type UpdateRelationshipResult } from "./updateRelationship";
export { deleteRelationshipExecutor, type DeleteRelationshipArgs, type DeleteRelationshipResult } from "./deleteRelationship";
export { generateContentExecutor, type GenerateContentArgs, type GenerateContentResult } from "./generateContent";
export { generateImageExecutor } from "./generateImage";
export type { GenerateImageArgs, GenerateImageResult } from "@mythos/agent-protocol";

// Saga unified agent tools
export { genesisWorldExecutor, type GenesisWorldExecutionResult } from "./genesisWorld";
export { detectEntitiesExecutor, type DetectEntitiesExecutionResult } from "./detectEntities";
export { checkConsistencyExecutor, type CheckConsistencyExecutionResult } from "./checkConsistency";
export { generateTemplateExecutor, type GenerateTemplateExecutionResult } from "./generateTemplate";
export { clarityCheckExecutor, type ClarityCheckExecutionResult } from "./clarityCheck";
