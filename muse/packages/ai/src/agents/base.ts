import { generateText, streamText, type CoreMessage } from "ai";
import type { LanguageModel } from "ai";
import { getModel, type UnifiedModelType } from "../providers";

export interface AnalysisContext {
  documentContent: string;
  entities?: unknown[];
  relationships?: unknown[];
  projectConfig?: unknown;
  previousMessages?: CoreMessage[];
}

export interface StreamChunk {
  type: "text" | "tool-call" | "tool-result";
  content: string;
}

export interface AgentConfig {
  name: string;
  systemPrompt: string;
  model?: UnifiedModelType;
  temperature?: number;
  maxTokens?: number;
}

export abstract class NarrativeAgent {
  protected config: AgentConfig;
  protected model: LanguageModel;

  constructor(config: AgentConfig) {
    this.config = config;
    this.model = getModel(config.model || "analysis");
  }

  async analyze(context: AnalysisContext): Promise<string> {
    const messages = this.buildMessages(context);

    const result = await generateText({
      model: this.model,
      system: this.config.systemPrompt,
      messages,
      temperature: this.config.temperature ?? 0.3,
      maxTokens: this.config.maxTokens ?? 4096,
    });

    return result.text;
  }

  async *stream(context: AnalysisContext): AsyncIterable<StreamChunk> {
    const messages = this.buildMessages(context);

    const result = streamText({
      model: this.model,
      system: this.config.systemPrompt,
      messages,
      temperature: this.config.temperature ?? 0.3,
      maxTokens: this.config.maxTokens ?? 4096,
    });

    for await (const chunk of (await result).textStream) {
      yield { type: "text", content: chunk };
    }
  }

  protected buildMessages(context: AnalysisContext): CoreMessage[] {
    const messages: CoreMessage[] = context.previousMessages || [];

    // Build context message
    let contextMessage = `## Document Content:\n${context.documentContent}`;

    if (context.entities && context.entities.length > 0) {
      contextMessage += `\n\n## Known Entities:\n${JSON.stringify(context.entities, null, 2)}`;
    }

    if (context.relationships && context.relationships.length > 0) {
      contextMessage += `\n\n## Relationships:\n${JSON.stringify(context.relationships, null, 2)}`;
    }

    if (context.projectConfig) {
      contextMessage += `\n\n## Project Configuration:\n${JSON.stringify(context.projectConfig, null, 2)}`;
    }

    messages.push({ role: "user", content: contextMessage });

    return messages;
  }
}
