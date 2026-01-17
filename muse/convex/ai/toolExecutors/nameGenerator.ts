import { internal } from "../../_generated/api";
import type { ActionCtx } from "../../_generated/server";
import type { TierId } from "../../lib/providers/types";
import { resolveExecutionContext } from "../llmExecution";
import { callOpenRouterJson } from "./openRouter";

export async function executeNameGenerator(
  ctx: ActionCtx,
  input: {
    entityType: string;
    genre?: string;
    culture?: string;
    count?: number;
    tone?: string;
  },
  userId: string
): Promise<{
  names: Array<{
    name: string;
    meaning?: string;
    origin?: string;
  }>;
}> {
  const count = input.count || 10;
  const genre = input.genre || "fantasy";
  const culture = input.culture || "varied";
  const tone = input.tone || "neutral";

  const systemPrompt = `You are a name generator for fiction. Generate ${count} names.

Entity type: ${input.entityType}
Genre: ${genre}
Cultural inspiration: ${culture}
Tone: ${tone}

For each name, optionally provide meaning and origin.

Respond with JSON containing a "names" array.`;

  const tierId = (await ctx.runQuery((internal as any)["lib/entitlements"].getUserTierInternal, {
    userId,
  })) as TierId;
  const exec = await resolveExecutionContext(ctx, {
    userId,
    taskSlug: "name_generator",
    tierId,
    promptText: systemPrompt,
    endpoint: "chat",
    requestedMaxOutputTokens: 2048,
  });

  if (exec.resolved.provider !== "openrouter") {
    throw new Error(`Provider ${exec.resolved.provider} is not supported for name_generator`);
  }

  const parsed = await callOpenRouterJson<{ names?: Array<{ name: string; meaning?: string; origin?: string }> }>({
    model: exec.resolved.model,
    system: systemPrompt,
    user: `Generate ${count} names for a ${input.entityType}`,
    maxTokens: Math.min(exec.maxOutputTokens, 2048),
    temperature: exec.temperature,
    apiKeyOverride: exec.apiKey,
    responseFormat: exec.responseFormat,
  });

  return { names: Array.isArray(parsed.names) ? parsed.names : [] };
}
