import { internal } from "../../_generated/api";
import type { ActionCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import type { ProjectManageResult } from "../../../packages/agent-protocol/src/tools";
import { executeGenerateTemplate } from "./templateGenerator";

export async function executeProjectManage(
  ctx: ActionCtx,
  input: unknown,
  projectId: string
): Promise<ProjectManageResult> {
  if (!input || typeof input !== "object") {
    throw new Error("project_manage input is required");
  }

  const record = input as Record<string, unknown>;
  const action = record["action"];

  if (action === "bootstrap") {
    const description =
      typeof record["description"] === "string" ? record["description"].trim() : "";
    if (!description) {
      throw new Error("project_manage.bootstrap requires a description");
    }

    const seedRaw = record["seed"];
    const seed = typeof seedRaw === "boolean" ? seedRaw : true;

    const genre = typeof record["genre"] === "string" ? (record["genre"] as string) : undefined;
    const entityCount =
      typeof record["entityCount"] === "number" ? (record["entityCount"] as number) : undefined;
    const detailLevelRaw = typeof record["detailLevel"] === "string" ? record["detailLevel"] : undefined;
    const detailLevel =
      detailLevelRaw === "minimal" || detailLevelRaw === "standard" || detailLevelRaw === "detailed"
        ? detailLevelRaw
        : undefined;
    const includeOutline =
      typeof record["includeOutline"] === "boolean" ? (record["includeOutline"] as boolean) : true;
    const skipEntityTypes = Array.isArray(record["skipEntityTypes"])
      ? (record["skipEntityTypes"] as unknown[]).filter((t) => typeof t === "string")
      : undefined;

    let templateComplexity: "simple" | "standard" | "complex" = "standard";
    if (detailLevel === "minimal") {
      templateComplexity = "simple";
    } else if (detailLevel === "detailed") {
      templateComplexity = "complex";
    }

    // Always generate template structure
    const templateResult = await executeGenerateTemplate({
      storyDescription: description,
      genreHints: genre ? [genre] : undefined,
      complexity: detailLevel ? templateComplexity : undefined,
    });

    // Structure-only: return template without running genesis
    if (!seed) {
      return {
        action: "bootstrap",
        status: "ok",
        persisted: false,
        template: templateResult?.template,
        suggestedStarterEntities: templateResult?.suggestedStarterEntities,
        worldSummary: "",
        entities: [],
        relationships: [],
      };
    }

    const genesisResult = await ctx.runAction((internal as any)["ai/genesis"].runGenesis, {
      prompt: description,
      genre,
      entityCount,
      detailLevel,
      includeOutline,
    });

    const entities = Array.isArray(genesisResult?.entities)
      ? (genesisResult.entities as Array<{
          name: string;
          type: string;
          description: string;
          properties?: Record<string, unknown>;
          relationships?: Array<{
            targetName: string;
            type: string;
            description?: string;
          }>;
        }>)
      : [];

    const relationships = entities.flatMap((entity) => {
      const rels = Array.isArray(entity.relationships) ? entity.relationships : [];
      return rels
        .filter((rel) => typeof rel?.targetName === "string" && rel.targetName.length > 0)
        .map((rel) => ({
          source: entity.name,
          target: rel.targetName,
          type: rel.type,
          description: rel.description,
        }));
    });

    const baseResult: ProjectManageResult = {
      action: "bootstrap",
      status: "ok",
      persisted: seed,
      template: templateResult?.template,
      suggestedStarterEntities: templateResult?.suggestedStarterEntities,
      worldSummary: typeof genesisResult?.worldSummary === "string" ? genesisResult.worldSummary : "",
      suggestedTitle:
        typeof genesisResult?.suggestedTitle === "string" ? genesisResult.suggestedTitle : undefined,
      outline: Array.isArray(genesisResult?.outline)
        ? (genesisResult.outline as Array<{ title: string; summary: string }>)
        : undefined,
      entities: entities.map((entity) => ({
        name: entity.name,
        type: entity.type,
        description: entity.description,
        properties: entity.properties,
      })),
      relationships,
    };

    if (!seed) {
      return baseResult;
    }

    if (projectId === "template-builder") {
      return {
        action: "bootstrap",
        status: "ok",
        persisted: false,
        worldSummary: baseResult.worldSummary,
        suggestedTitle: baseResult.suggestedTitle,
        outline: baseResult.outline,
        entities: baseResult.entities,
        relationships: baseResult.relationships,
        persistence: {
          success: false,
          entitiesCreated: 0,
          relationshipsCreated: 0,
          errors: ["Cannot persist bootstrap results in template-builder mode."],
        },
      };
    }

    const persistResult = await ctx.runAction((internal as any)["ai/genesis"].persistGenesisWorld, {
      projectId: projectId as Id<"projects">,
      result: genesisResult,
      skipEntityTypes,
    });

    return {
      ...baseResult,
      persistence: {
        success: !!persistResult?.success,
        entitiesCreated: typeof persistResult?.entitiesCreated === "number" ? persistResult.entitiesCreated : 0,
        relationshipsCreated:
          typeof persistResult?.relationshipsCreated === "number" ? persistResult.relationshipsCreated : 0,
        errors: Array.isArray(persistResult?.errors)
          ? (persistResult.errors as unknown[]).filter((e) => typeof e === "string")
          : [],
      },
    };
  }

  if (action === "restructure" || action === "pivot") {
    return {
      action,
      status: "not_implemented",
      message: "project_manage currently supports action: bootstrap only.",
      supportedActions: ["bootstrap"],
    } satisfies ProjectManageResult;
  }

  throw new Error('project_manage requires action: "bootstrap" | "restructure" | "pivot"');
}
