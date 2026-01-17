import { internal } from "../../_generated/api";
import type { ActionCtx } from "../../_generated/server";
import type { TierId } from "../../lib/providers/types";
import { resolveExecutionContext } from "../llmExecution";
import { callOpenRouterJson } from "./openRouter";

interface GenerateContentInput {
  entityId: string;
  contentType: "description" | "backstory" | "dialogue" | "scene";
  context?: string;
  length?: "short" | "medium" | "long";
}

interface GenerateContentResult {
  content: string;
  contentType: string;
  entityId: string;
  wordCount: number;
}

const GENERATE_CONTENT_SYSTEM = `You are a creative writing assistant. Generate high-quality content for worldbuilding entities.

Content types:
- description: Vivid, sensory description of appearance/location/object
- backstory: Character history and formative experiences
- dialogue: In-character speech samples that reveal personality
- scene: A short narrative scene featuring the entity

Write in a literary style appropriate for fiction. Focus on showing rather than telling.
Be specific and evocative. Avoid generic descriptions.

Respond with JSON containing:
- content: The generated text
- wordCount: Approximate word count`;

export async function executeGenerateContent(
  ctx: ActionCtx,
  input: GenerateContentInput,
  _projectId: string,
  userId: string
): Promise<GenerateContentResult> {
  const length = input.length ?? "medium";
  const wordTargets = { short: 100, medium: 250, long: 500 };
  const targetWords = wordTargets[length];

  const userContent = `Generate ${input.contentType} content for entity ${input.entityId}.

Target length: ~${targetWords} words (${length})
${input.context ? `\nContext: ${input.context}` : ""}

Generate ${input.contentType} content now.`;

  const tierId = (await ctx.runQuery((internal as any)["lib/entitlements"].getUserTierInternal, {
    userId,
  })) as TierId;
  const exec = await resolveExecutionContext(ctx, {
    userId,
    taskSlug: "generation",
    tierId,
    promptText: userContent,
    endpoint: "chat",
    requestedMaxOutputTokens: 2048,
  });

  if (exec.resolved.provider !== "openrouter") {
    throw new Error(`Provider ${exec.resolved.provider} is not supported for generate_content`);
  }

  const parsed = await callOpenRouterJson<{ content?: string; wordCount?: number }>({
    model: exec.resolved.model,
    system: GENERATE_CONTENT_SYSTEM,
    user: userContent,
    maxTokens: Math.min(exec.maxOutputTokens, 2048),
    temperature: exec.temperature,
    apiKeyOverride: exec.apiKey,
    responseFormat: "json_object",
  });

  return {
    content: parsed.content || "",
    contentType: input.contentType,
    entityId: input.entityId,
    wordCount: parsed.wordCount || parsed.content?.split(/\s+/).length || 0,
  };
}
