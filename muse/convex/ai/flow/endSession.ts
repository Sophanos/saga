import { v } from "convex/values";
import { action } from "../../_generated/server";

const internal = require("../../_generated/api").internal as any;

const SESSION_GRACE_MS = 15 * 60 * 1000;

export const endSession = action({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const userId = identity.subject;

    const runtimeSession = await ctx.runQuery(
      (internal as any)["ai/flow/runtimeSessions"].getRuntimeSessionInternal,
      { sessionId }
    );
    if (!runtimeSession || runtimeSession.userId !== userId) {
      throw new Error("Invalid session");
    }

    const now = Date.now();
    await ctx.runMutation(
      (internal as any)["ai/flow/runtimeSessions"].updateRuntimeSessionInternal,
      {
        id: runtimeSession._id,
        patch: {
          status: "ended",
          endedAt: now,
          expiresAt: now + SESSION_GRACE_MS,
        },
      }
    );

    await ctx.scheduler.runAfter(
      SESSION_GRACE_MS,
      (internal as any)["ai/flow/cleanupSessionVectors"].cleanupSessionVectors,
      { sessionId }
    );

    return { ok: true };
  },
});
