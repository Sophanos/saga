/**
 * AI Tool Types - Definitions for AI agent tool calls
 * Used by both Convex backend and Expo frontend
 */

import type { EntityType, RelationType } from '../entities/types';

// Panel types for workspace control
export type PanelType =
  | 'character'
  | 'relationship'
  | 'world'
  | 'timeline'
  | 'factions'
  | 'magic';

// World builder tabs
export type WorldBuilderTab =
  | 'factions'
  | 'magic'
  | 'timeline'
  | 'geography'
  | 'cultures'
  | 'history';

// Question option for ask_question tool
export interface QuestionOption {
  label: string;
  value: string;
}

// --- UI Control Tools ---

/**
 * Ask the writer a question for clarification or creative choices
 * Supports 0-N options (0 = freeform input)
 */
export interface AskQuestionTool {
  type: 'ask_question';
  id: string;
  question: string;
  options?: QuestionOption[];
  context?: string;
  allowFreeform?: boolean;
  multiSelect?: boolean;
}

/**
 * Open a workspace panel for focused work
 */
export interface OpenPanelTool {
  type: 'open_panel';
  panel: PanelType;
  params?: {
    entityIds?: string[];
    tab?: WorldBuilderTab;
    focus?: string;
  };
}

/**
 * Focus on a specific entity in the current workspace
 */
export interface FocusEntityTool {
  type: 'focus_entity';
  entityId: string;
  highlight?: boolean;
}

/**
 * Display a relationship graph between entities
 */
export interface ShowGraphTool {
  type: 'show_graph';
  entities: string[];
  depth?: number;
  highlightPath?: [string, string];
}

// --- Entity Operation Tools ---

/**
 * Create a new entity
 */
export interface CreateEntityTool {
  type: 'create_entity';
  entity: {
    type: EntityType;
    name: string;
    aliases?: string[];
    properties?: Record<string, unknown>;
  };
  askConfirm?: boolean;
}

/**
 * Update an existing entity
 */
export interface UpdateEntityTool {
  type: 'update_entity';
  entityId: string;
  updates: {
    name?: string;
    aliases?: string[];
    properties?: Record<string, unknown>;
  };
}

/**
 * Create a relationship between entities
 */
export interface CreateRelationshipTool {
  type: 'create_relationship';
  from: string;
  to: string;
  relationType: RelationType;
  bidirectional?: boolean;
  strength?: number;
  metadata?: Record<string, unknown>;
}

// --- Analysis Tools ---

/**
 * Analyze consistency across content
 */
export interface AnalyzeConsistencyTool {
  type: 'analyze_consistency';
  scope: 'project' | 'chapter' | 'entity';
  entityId?: string;
  documentId?: string;
}

/**
 * Suggest connections for an entity
 */
export interface SuggestConnectionsTool {
  type: 'suggest_connections';
  entityId: string;
  maxSuggestions?: number;
}

/**
 * Find potential issues in the story
 */
export interface FindIssuesTool {
  type: 'find_issues';
  scope: 'project' | 'chapter' | 'selection';
  categories?: ('plot_hole' | 'timeline' | 'character' | 'logic' | 'continuity')[];
}

// --- Union Types ---

export type UIControlTool =
  | AskQuestionTool
  | OpenPanelTool
  | FocusEntityTool
  | ShowGraphTool;

export type EntityOperationTool =
  | CreateEntityTool
  | UpdateEntityTool
  | CreateRelationshipTool;

export type AnalysisTool =
  | AnalyzeConsistencyTool
  | SuggestConnectionsTool
  | FindIssuesTool;

export type ToolCall =
  | UIControlTool
  | EntityOperationTool
  | AnalysisTool;

// Tool call status
export type ToolCallStatus = 'pending' | 'running' | 'complete' | 'error';

// Tool execution record
export interface ToolExecution {
  id: string;
  tool: ToolCall;
  status: ToolCallStatus;
  result?: unknown;
  error?: string;
  timestamp: number;
}

// --- OpenAI/Anthropic Tool Definitions ---

/**
 * Tool definitions for LLM function calling
 * Compatible with OpenAI and Anthropic tool formats
 */
export const UI_TOOL_DEFINITIONS = [
  {
    name: 'ask_question',
    description: 'Ask the writer a question. Use for clarification, creative choices, or branching decisions. Omit options for free-form text input.',
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The question to ask the writer',
        },
        options: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', description: 'Display text for the option' },
              value: { type: 'string', description: 'Value returned when selected' },
            },
            required: ['label', 'value'],
          },
          description: 'Optional choices. Omit for free-form text input.',
        },
        context: {
          type: 'string',
          description: 'Brief description of what this question affects',
        },
        multiSelect: {
          type: 'boolean',
          description: 'Allow multiple selections (only with options)',
        },
      },
      required: ['question'],
    },
  },
  {
    name: 'open_panel',
    description: 'Open a workspace panel for focused work on characters, world-building, or relationships.',
    parameters: {
      type: 'object',
      properties: {
        panel: {
          type: 'string',
          enum: ['character', 'relationship', 'world', 'timeline', 'factions', 'magic'],
          description: 'Type of panel to open',
        },
        entityIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Entity IDs to load into the panel',
        },
        tab: {
          type: 'string',
          enum: ['factions', 'magic', 'timeline', 'geography', 'cultures', 'history'],
          description: 'Tab to open (for world panel)',
        },
        focus: {
          type: 'string',
          description: 'Entity ID to focus on',
        },
      },
      required: ['panel'],
    },
  },
  {
    name: 'focus_entity',
    description: 'Focus on a specific entity in the current workspace, optionally highlighting it.',
    parameters: {
      type: 'object',
      properties: {
        entityId: {
          type: 'string',
          description: 'ID of the entity to focus on',
        },
        highlight: {
          type: 'boolean',
          description: 'Whether to visually highlight the entity',
        },
      },
      required: ['entityId'],
    },
  },
  {
    name: 'show_graph',
    description: 'Display a relationship graph showing connections between entities.',
    parameters: {
      type: 'object',
      properties: {
        entities: {
          type: 'array',
          items: { type: 'string' },
          description: 'Entity IDs to include in the graph',
        },
        depth: {
          type: 'number',
          description: 'How many relationship levels to show (default: 1)',
        },
        highlightPath: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 2,
          minItems: 2,
          description: 'Two entity IDs to highlight the path between',
        },
      },
      required: ['entities'],
    },
  },
] as const;

export const ENTITY_TOOL_DEFINITIONS = [
  {
    name: 'create_entity',
    description: 'Create a new entity (character, location, item, etc.) in the story world.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['character', 'location', 'item', 'magic_system', 'faction', 'event', 'concept'],
          description: 'Type of entity to create',
        },
        name: {
          type: 'string',
          description: 'Name of the entity',
        },
        aliases: {
          type: 'array',
          items: { type: 'string' },
          description: 'Alternative names or nicknames',
        },
        properties: {
          type: 'object',
          description: 'Type-specific properties for the entity',
        },
        askConfirm: {
          type: 'boolean',
          description: 'Ask writer for confirmation before creating',
        },
      },
      required: ['type', 'name'],
    },
  },
  {
    name: 'create_relationship',
    description: 'Create a relationship between two entities.',
    parameters: {
      type: 'object',
      properties: {
        from: {
          type: 'string',
          description: 'Source entity ID',
        },
        to: {
          type: 'string',
          description: 'Target entity ID',
        },
        relationType: {
          type: 'string',
          enum: [
            'knows', 'loves', 'hates', 'killed', 'created',
            'owns', 'guards', 'weakness', 'strength',
            'parent_of', 'child_of', 'sibling_of', 'married_to',
            'allied_with', 'enemy_of', 'member_of', 'rules', 'serves',
          ],
          description: 'Type of relationship',
        },
        bidirectional: {
          type: 'boolean',
          description: 'Whether the relationship goes both ways',
        },
        strength: {
          type: 'number',
          minimum: 1,
          maximum: 10,
          description: 'Strength of the relationship (1-10)',
        },
      },
      required: ['from', 'to', 'relationType'],
    },
  },
] as const;

export const ANALYSIS_TOOL_DEFINITIONS = [
  {
    name: 'analyze_consistency',
    description: 'Check for inconsistencies in the story, character development, or world-building.',
    parameters: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          enum: ['project', 'chapter', 'entity'],
          description: 'Scope of analysis',
        },
        entityId: {
          type: 'string',
          description: 'Entity ID (when scope is entity)',
        },
        documentId: {
          type: 'string',
          description: 'Document ID (when scope is chapter)',
        },
      },
      required: ['scope'],
    },
  },
  {
    name: 'suggest_connections',
    description: 'Suggest potential relationships or connections for an entity based on the story.',
    parameters: {
      type: 'object',
      properties: {
        entityId: {
          type: 'string',
          description: 'Entity to find connections for',
        },
        maxSuggestions: {
          type: 'number',
          description: 'Maximum number of suggestions (default: 5)',
        },
      },
      required: ['entityId'],
    },
  },
] as const;

// Combined tool definitions for AI
export const ALL_TOOL_DEFINITIONS = [
  ...UI_TOOL_DEFINITIONS,
  ...ENTITY_TOOL_DEFINITIONS,
  ...ANALYSIS_TOOL_DEFINITIONS,
] as const;
