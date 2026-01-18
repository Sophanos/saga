import { v } from "convex/values";
import { internalAction } from "../../_generated/server";
import { isQdrantConfigured } from "../../lib/qdrant";
import { deleteSessionVectors } from "../../lib/qdrantSessionVectors";

const internal = require("../../_generated/api").internal as any;

async function expireSession(ctx: any, session: any): Promise<void> {
  if (isQdrantConfigured()) {
    await deleteSessionVectors({
      projectId: String(session.projectId),
      sessionId: String(session.sessionId),
    });
  }

  await ctx.runMutation(
    (internal as any)["ai/flow/runtimeSessions"].updateRuntimeSessionInternal,
    {
      id: session._id,
      patch: { status: "expired", endedAt: session.endedAt ?? Date.now() },
    }
  );
}

export const cleanupSessionVectors = internalAction({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const runtimeSession = await ctx.runQuery(
      (internal as any)["ai/flow/runtimeSessions"].getRuntimeSessionInternal,
      { sessionId }
    );
    if (!runtimeSession) return;
    await expireSession(ctx, runtimeSession);
  },
});

export const cleanupExpiredSessions = internalAction({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const now = Date.now();
    const expiredSessions = await ctx.runQuery(
      (internal as any)["ai/flow/runtimeSessions"].listExpiredRuntimeSessionsInternal,
      { now, limit }
    );

    for (const session of expiredSessions) {
      await expireSession(ctx, session);
    }

    return { cleaned: expiredSessions.length };
  },
});
