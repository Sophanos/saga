/**
 * AI Tools - Exports all agent tools
 */

export { askQuestionTool, writeContentTool } from "./editorTools";
export {
  searchContextTool,
  readDocumentTool,
  searchChaptersTool,
  searchWorldTool,
  getEntityTool,
} from "./ragTools";
export {
  // Entity tools
  createEntityTool,
  updateEntityTool,
  createEntityNeedsApproval,
  updateEntityNeedsApproval,
  type CreateEntityArgs,
  type UpdateEntityArgs,
  // Project graph (generic) tools
  createNodeTool,
  updateNodeTool,
  type CreateNodeArgs,
  type UpdateNodeArgs,
  // Relationship tools
  createRelationshipTool,
  updateRelationshipTool,
  createRelationshipNeedsApproval,
  updateRelationshipNeedsApproval,
  type CreateRelationshipArgs,
  type UpdateRelationshipArgs,
  // Project graph (generic) edges
  createEdgeTool,
  updateEdgeTool,
  type CreateEdgeArgs,
  type UpdateEdgeArgs,
  // Image tools
  generateImageTool,
  generateImageNeedsApproval,
  type GenerateImageArgs,
  illustrateSceneTool,
  illustrateSceneNeedsApproval,
  type IllustrateSceneArgs,
  analyzeImageTool,
  analyzeImageNeedsApproval,
  type AnalyzeImageArgs,
} from "./worldGraphTools";
export { expandChunkContext } from "./ragHandlers";
export {
  executeCreateEntity,
  executeUpdateEntity,
  executeCreateRelationship,
  executeUpdateRelationship,
  executeCreateNode,
  executeUpdateNode,
  executeCreateEdge,
  executeUpdateEdge,
} from "./worldGraphHandlers";
