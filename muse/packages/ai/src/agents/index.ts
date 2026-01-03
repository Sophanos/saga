export { NarrativeAgent, type AnalysisContext, type StreamChunk, type AgentConfig } from "./base";
export { ConsistencyLinter, consistencyLinter, type ConsistencyIssue, type ConsistencyResult, type CanonChoice } from "./consistency-linter";
export { runGenesis, detectGenre, type GenesisInput, type GenesisResult, type SuggestedEntity } from "./genesis-wizard";
export { WritingCoach, writingCoach } from "./writing-coach";
export { EntityDetector, entityDetector, detectEntities, detectEntitiesWithContext } from "./entity-detector";
export {
  DynamicsExtractor,
  dynamicsExtractor,
  extractDynamics,
  extractHostileDynamics,
  extractHiddenDynamics,
  type ExtractedInteraction,
  type DynamicsExtractionResult,
  type DynamicsExtractionInput,
  type DynamicsResult,
} from "./dynamics-extractor";

// Saga ToolLoopAgent - Unified AI assistant
export {
  // Main agent class and instance
  SagaAgent,
  sagaAgent,
  // System prompt builder
  buildSagaSystemPrompt,
  // Tool definitions
  coreTools,
  sagaTools,
  sagaAgentTools,
  // Utility functions
  stepCountIs,
  // Schemas (for validation)
  SagaModeSchema,
  EditorContextSchema,
  RAGContextSchema,
  MentionContextSchema,
  RetrievedMemoryContextSchema,
  ProfileContextSchema,
  EntityTypeSchema,
  RelationTypeSchema,
  SagaCallOptionsSchema,
  // Types
  type SagaMode,
  type EditorContext,
  type RAGContext,
  type RAGContextItem,
  type MentionContext,
  type RetrievedMemoryContext,
  type RetrievedMemoryRecord,
  type ProfileContext,
  type EntityType,
  type RelationType,
  type ItemCategory,
  type ContentType,
  type Length,
  type GenesisDetailLevel,
  type AnalysisScope,
  type TemplateComplexity,
  type ConsistencyFocus,
  type LogicFocus,
  type LogicStrictness,
  type NameCulture,
  type NameStyle,
  type SagaCallOptions,
  type SagaAgentConfig,
  type SagaAgentInput,
  type SagaAgentResult,
  type SagaToolName,
  type SagaToolArgs,
  type SagaAgentUIMessage,
  type InferAgentUIMessage,
  type ToolProposal,
  // Tool argument types
  type CreateEntityArgs,
  type UpdateEntityArgs,
  type DeleteEntityArgs,
  type CreateRelationshipArgs,
  type UpdateRelationshipArgs,
  type DeleteRelationshipArgs,
  type GenerateContentArgs,
  type GenesisWorldArgs,
  type DetectEntitiesArgs,
  type CheckConsistencyArgs,
  type GenerateTemplateArgs,
  type ClarityCheckArgs,
  type CheckLogicArgs,
  type NameGeneratorArgs,
} from "./saga";
