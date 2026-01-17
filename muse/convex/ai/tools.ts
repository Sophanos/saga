/**
 * AI Tool Execution
 *
 * Handles execution of AI tools for the saga agent.
 * Tools can create/update entities, check consistency, generate content, etc.
 */

"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import type { AnalyzeContentArgs, AnalyzeImageArgs } from "../../packages/agent-protocol/src/tools";
import { executeAnalyzeContent } from "./toolExecutors/analyzeContent";
import { executeAnalyzeImage } from "./toolExecutors/imageAnalysis";
import { executeCommitDecision } from "./toolExecutors/commitDecision";
import { executeGenerateContent } from "./toolExecutors/generateContent";
import { executeGenerateTemplate } from "./toolExecutors/templateGenerator";
import { executeNameGenerator } from "./toolExecutors/nameGenerator";
import { executeProjectManage } from "./toolExecutors/projectManage";

export const execute = internalAction({
  args: {
    toolName: v.string(),
    input: v.any(),
    projectId: v.string(),
    userId: v.string(),
    source: v.optional(
      v.object({
        suggestionId: v.optional(v.string()),
        toolCallId: v.optional(v.string()),
        streamId: v.optional(v.string()),
        threadId: v.optional(v.string()),
        promptMessageId: v.optional(v.string()),
        model: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args): Promise<unknown> => {
    const { toolName, input, projectId, userId, source } = args;

    console.log(`[tools.execute] ${toolName}`, { projectId, userId });

    switch (toolName) {
      case "analyze_content":
        return executeAnalyzeContent(ctx, input as AnalyzeContentArgs, projectId, userId);

      case "detect_entities": {
        const result = await executeAnalyzeContent(
          ctx,
          {
            mode: "entities",
            text: input.text,
            options: {
              entityTypes: input.entityTypes,
              minConfidence: input.minConfidence,
            },
          },
          projectId,
          userId
        );
        const stats = result.mode === "entities" ? (result.stats as { warnings?: unknown[] } | undefined) : undefined;
        return {
          entities: result.mode === "entities" ? result.entities : [],
          warnings: stats?.warnings,
        };
      }

      case "check_consistency": {
        const result = await executeAnalyzeContent(
          ctx,
          {
            mode: "consistency",
            text: input.text,
            options: { focus: input.focus },
          },
          projectId,
          userId
        );
        const stats = result.mode === "consistency" ? (result.stats as { rawIssues?: unknown[] } | undefined) : undefined;
        return {
          issues: Array.isArray(stats?.rawIssues) ? stats?.rawIssues : [],
          summary: result.summary,
        };
      }

      case "project_manage":
        return executeProjectManage(ctx, input, projectId);

      case "generate_template":
        return executeGenerateTemplate(input);

      case "clarity_check": {
        const result = await executeAnalyzeContent(
          ctx,
          {
            mode: "clarity",
            text: input.text,
            options: { maxIssues: input.maxIssues },
          },
          projectId,
          userId
        );
        const stats = result.mode === "clarity" ? (result.stats as { rawIssues?: unknown[]; readability?: unknown } | undefined) : undefined;
        return {
          issues: Array.isArray(stats?.rawIssues) ? stats?.rawIssues : [],
          summary: result.summary,
          readability: stats?.readability,
        };
      }

      case "policy_check": {
        const result = await executeAnalyzeContent(
          ctx,
          {
            mode: "policy",
            text: input.text,
            options: { maxIssues: input.maxIssues },
          },
          projectId,
          userId
        );
        const stats = result.mode === "policy" ? (result.stats as { rawIssues?: unknown[]; compliance?: unknown } | undefined) : undefined;
        return {
          issues: Array.isArray(stats?.rawIssues) ? stats?.rawIssues : [],
          summary: result.summary,
          compliance: stats?.compliance,
        };
      }

      case "name_generator":
        return executeNameGenerator(input);

      case "commit_decision":
        return executeCommitDecision(ctx, input, projectId, userId, source ?? undefined);

      case "search_images": {
        // Legacy alias: route through unified analyze_image with mode="search"
        const searchResult = await executeAnalyzeImage(ctx, {
          mode: "search",
          query: input.query,
          options: {
            limit: input.limit,
            assetType: input.assetType,
            entityType: input.entityType,
            style: input.style,
          },
        }, projectId, userId);
        // Transform to legacy shape
        if (searchResult.mode === "search") {
          return { query: searchResult.query, results: searchResult.results };
        }
        throw new Error("Unexpected result mode from search_images");
      }

      case "find_similar_images": {
        // Legacy alias: route through unified analyze_image with mode="similar"
        const similarResult = await executeAnalyzeImage(ctx, {
          mode: "similar",
          assetId: input.assetId,
          entityName: input.entityName,
          options: {
            limit: input.limit,
            assetType: input.assetType,
            entityType: input.entityType,
          },
        }, projectId, userId);
        // Transform to legacy shape
        if (similarResult.mode === "similar") {
          return { referenceAssetId: similarResult.referenceAssetId, results: similarResult.results };
        }
        throw new Error("Unexpected result mode from find_similar_images");
      }

      case "check_logic": {
        const result = await executeAnalyzeContent(
          ctx,
          {
            mode: "logic",
            text: input.text,
            options: { focus: input.focus, strictness: input.strictness },
          },
          projectId,
          userId
        );
        const stats = result.mode === "logic" ? (result.stats as { rawIssues?: unknown[] } | undefined) : undefined;
        return {
          issues: Array.isArray(stats?.rawIssues) ? stats?.rawIssues : [],
          summary: result.summary,
        };
      }

      case "generate_content":
        return executeGenerateContent(input, projectId);

      case "analyze_image":
        return executeAnalyzeImage(ctx, input as AnalyzeImageArgs, projectId, userId);

      default:
        throw new Error(
          `Unknown tool: ${toolName}. Supported tools: project_manage, analyze_content, detect_entities, check_consistency, generate_template, clarity_check, policy_check, check_logic, name_generator, commit_decision, search_images, find_similar_images, generate_content, analyze_image`
        );
    }
  },
});
