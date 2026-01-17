/**
 * AI Tools - Exports all agent tools
 */

export { askQuestionTool, writeContentTool } from "./editorTools";
export { searchContextTool, readDocumentTool, getEntityTool } from "./ragTools";
export {
  // Entity tools
  createEntityTool,
  updateEntityTool,
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
  type CreateRelationshipArgs,
  type UpdateRelationshipArgs,
  // Project graph (generic) edges
  createEdgeTool,
  updateEdgeTool,
  type CreateEdgeArgs,
  type UpdateEdgeArgs,
  // Consolidated graph tool
  graphMutationTool,
  type GraphMutationArgs,
  // Image tools
  generateImageTool,
  generateImageNeedsApproval,
  type GenerateImageArgs,
  analyzeImageTool,
  analyzeImageNeedsApproval,
  type AnalyzeImageArgs,
} from "./projectGraphTools";
export { expandChunkContext } from "./ragHandlers";
export { analyzeContentTool, type AnalyzeContentArgs } from "./analysisTools";
export { evidenceMutationTool } from "./evidenceTools";
export {
  viewVersionHistoryTool,
  viewCommentsTool,
  addCommentTool,
  searchUsersTool,
  deleteDocumentTool,
} from "./collaborationTools";
export {
  artifactTool,
  artifactStageTool,
  artifactDiagramTool,
  artifactTableTool,
  artifactTimelineTool,
  artifactProseTool,
  artifactLinkTool,
  type ArtifactToolArgs,
  type ArtifactStageArgs,
  type ArtifactDiagramArgs,
  type ArtifactTableArgs,
  type ArtifactTimelineArgs,
  type ArtifactProseArgs,
  type ArtifactLinkArgs,
} from "./artifactTools";
export {
  executeCreateEntity,
  executeUpdateEntity,
  executeCreateRelationship,
  executeUpdateRelationship,
  executeCreateNode,
  executeUpdateNode,
  executeCreateEdge,
  executeUpdateEdge,
  executeGraphMutation,
} from "./projectGraphHandlers";
