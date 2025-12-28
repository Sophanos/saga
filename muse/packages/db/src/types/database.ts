// Generated types from Supabase
// Run `bun db:generate` to regenerate after schema changes

// Type for tension analysis data
export interface TensionData {
  overall_tension?: number;
  conflict_level?: number;
  stakes?: number;
  urgency?: number;
  emotional_intensity?: number;
  [key: string]: unknown;
}

// Type for sensory analysis data
export interface SensoryData {
  visual?: number;
  auditory?: number;
  tactile?: number;
  olfactory?: number;
  gustatory?: number;
  balance?: number;
  [key: string]: unknown;
}

// Type for character presence in scenes
export interface CharacterPresence {
  entity_id: string;
  name: string;
  mentions: number;
  dialogue_count?: number;
  action_count?: number;
}

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          genre: string | null;
          style_config: Record<string, unknown> | null;
          linter_config: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          genre?: string | null;
          style_config?: Record<string, unknown> | null;
          linter_config?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          genre?: string | null;
          style_config?: Record<string, unknown> | null;
          linter_config?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
          user_id?: string | null;
        };
      };
      entities: {
        Row: {
          id: string;
          project_id: string;
          type: string;
          name: string;
          aliases: string[];
          properties: Record<string, unknown>;
          archetype: string | null;
          embedding: number[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          type: string;
          name: string;
          aliases?: string[];
          properties?: Record<string, unknown>;
          archetype?: string | null;
          embedding?: number[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          type?: string;
          name?: string;
          aliases?: string[];
          properties?: Record<string, unknown>;
          archetype?: string | null;
          embedding?: number[] | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      relationships: {
        Row: {
          id: string;
          project_id: string;
          source_id: string;
          target_id: string;
          type: string;
          bidirectional: boolean;
          strength: number | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          source_id: string;
          target_id: string;
          type: string;
          bidirectional?: boolean;
          strength?: number | null;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          source_id?: string;
          target_id?: string;
          type?: string;
          bidirectional?: boolean;
          strength?: number | null;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          project_id: string;
          parent_id: string | null;
          type: string;
          title: string | null;
          content: Record<string, unknown> | null;
          content_text: string | null;
          embedding: number[] | null;
          order_index: number;
          word_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          parent_id?: string | null;
          type: string;
          title?: string | null;
          content?: Record<string, unknown> | null;
          content_text?: string | null;
          embedding?: number[] | null;
          order_index?: number;
          word_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          parent_id?: string | null;
          type?: string;
          title?: string | null;
          content?: Record<string, unknown> | null;
          content_text?: string | null;
          embedding?: number[] | null;
          order_index?: number;
          word_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      mentions: {
        Row: {
          id: string;
          entity_id: string;
          document_id: string;
          position_start: number;
          position_end: number;
          context: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          entity_id: string;
          document_id: string;
          position_start: number;
          position_end: number;
          context: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          entity_id?: string;
          document_id?: string;
          position_start?: number;
          position_end?: number;
          context?: string;
          created_at?: string;
        };
      };
      interactions: {
        Row: {
          id: string;
          project_id: string;
          document_id: string | null;
          scene_id: string | null;
          source_id: string;
          target_id: string;
          action: string;
          type: string;
          time_marker: string;
          effect: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          document_id?: string | null;
          scene_id?: string | null;
          source_id: string;
          target_id: string;
          action: string;
          type: string;
          time_marker: string;
          effect?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          document_id?: string | null;
          scene_id?: string | null;
          source_id?: string;
          target_id?: string;
          action?: string;
          type?: string;
          time_marker?: string;
          effect?: string | null;
          note?: string | null;
          created_at?: string;
        };
      };
      scene_analysis: {
        Row: {
          id: string;
          project_id: string;
          document_id: string | null;
          scene_id: string | null;
          tension_data: TensionData;
          sensory_data: SensoryData;
          pacing: number | null;
          mood: string | null;
          show_dont_tell_score: number | null;
          word_count: number;
          dialogue_ratio: number | null;
          action_ratio: number | null;
          description_ratio: number | null;
          character_presence: CharacterPresence[];
          entity_mentions: Record<string, unknown>[];
          analyzed_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          document_id?: string | null;
          scene_id?: string | null;
          tension_data?: TensionData;
          sensory_data?: SensoryData;
          pacing?: number | null;
          mood?: string | null;
          show_dont_tell_score?: number | null;
          word_count?: number;
          dialogue_ratio?: number | null;
          action_ratio?: number | null;
          description_ratio?: number | null;
          character_presence?: CharacterPresence[];
          entity_mentions?: Record<string, unknown>[];
          analyzed_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          document_id?: string | null;
          scene_id?: string | null;
          tension_data?: TensionData;
          sensory_data?: SensoryData;
          pacing?: number | null;
          mood?: string | null;
          show_dont_tell_score?: number | null;
          word_count?: number;
          dialogue_ratio?: number | null;
          action_ratio?: number | null;
          description_ratio?: number | null;
          character_presence?: CharacterPresence[];
          entity_mentions?: Record<string, unknown>[];
          analyzed_at?: string;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      search_entities: {
        Args: {
          query_embedding: number[];
          match_threshold: number;
          match_count: number;
          project_filter: string;
        };
        Returns: {
          id: string;
          name: string;
          type: string;
          similarity: number;
        }[];
      };
      search_documents: {
        Args: {
          query_embedding: number[];
          match_threshold: number;
          match_count: number;
          project_filter: string;
        };
        Returns: {
          id: string;
          title: string;
          type: string;
          similarity: number;
        }[];
      };
      fulltext_search_documents: {
        Args: {
          search_query: string;
          project_filter: string;
          result_limit?: number;
        };
        Returns: {
          id: string;
          title: string;
          type: string;
          rank: number;
        }[];
      };
      hybrid_search_documents: {
        Args: {
          query_embedding: number[];
          search_query: string;
          project_filter: string;
          semantic_weight?: number;
          result_limit?: number;
        };
        Returns: {
          id: string;
          title: string;
          type: string;
          combined_score: number;
        }[];
      };
      get_latest_scene_analysis: {
        Args: {
          p_project_id: string;
          p_document_id?: string;
        };
        Returns: Database["public"]["Tables"]["scene_analysis"]["Row"][];
      };
      get_scene_analysis_history: {
        Args: {
          p_project_id: string;
          p_document_id: string;
          p_scene_id?: string;
          p_limit?: number;
        };
        Returns: Database["public"]["Tables"]["scene_analysis"]["Row"][];
      };
    };
    Enums: Record<string, never>;
  };
}
