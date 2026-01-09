/**
 * Presence API (Convex component)
 *
 * Exposes project/document presence with auth checks and optional metadata.
 */

import { Presence } from "@convex-dev/presence";
import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { verifyDocumentAccess, verifyProjectAccess } from "./lib/auth";

const presence = new Presence(components.presence);

const AI_USER_ID = "saga_ai";
const AI_NAME = "Muse";
const AI_COLOR = "#22D3EE";
const AI_INTERVAL_MS = 10_000;

function parseRoomId(roomId: string):
  | { scope: "project"; id: Id<"projects"> }
  | { scope: "document"; id: Id<"documents"> } {
  const [scope, ...rest] = roomId.split(":");
  const id = rest.join(":");
  if (!scope || !id) {
    throw new Error("Invalid roomId");
  }
  if (scope === "project") {
    return { scope, id: id as Id<"projects"> };
  }
  if (scope === "document") {
    return { scope, id: id as Id<"documents"> };
  }
  throw new Error("Invalid room scope");
}

async function verifyRoomAccess(ctx: any, roomId: string): Promise<{ userId: string }> {
  const parsed = parseRoomId(roomId);
  if (parsed.scope === "project") {
    const { userId } = await verifyProjectAccess(ctx, parsed.id);
    return { userId };
  }
  const { userId } = await verifyDocumentAccess(ctx, parsed.id);
  return { userId };
}

export const heartbeat = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    sessionId: v.string(),
    interval: v.number(),
  },
  handler: async (ctx, { roomId, userId, sessionId, interval }) => {
    const { userId: authUserId } = await verifyRoomAccess(ctx, roomId);
    if (authUserId !== userId) {
      throw new Error("Access denied");
    }
    return presence.heartbeat(ctx, roomId, userId, sessionId, interval);
  },
});

export const list = query({
  args: { roomToken: v.string() },
  handler: async (ctx, { roomToken }) => {
    return presence.list(ctx, roomToken);
  },
});

export const update = mutation({
  args: {
    roomId: v.string(),
    data: v.any(),
  },
  handler: async (ctx, { roomId, data }) => {
    const { userId } = await verifyRoomAccess(ctx, roomId);
    return presence.updateRoomUser(ctx, roomId, userId, data);
  },
});

export const disconnect = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    return presence.disconnect(ctx, sessionToken);
  },
});

export const setAiPresence = internalMutation({
  args: {
    roomId: v.string(),
    documentId: v.optional(v.string()),
    isTyping: v.boolean(),
  },
  handler: async (ctx, { roomId, documentId, isTyping }) => {
    await presence.heartbeat(ctx, roomId, AI_USER_ID, `ai:${roomId}`, AI_INTERVAL_MS);
    return presence.updateRoomUser(ctx, roomId, AI_USER_ID, {
      name: AI_NAME,
      avatarUrl: undefined,
      color: AI_COLOR,
      documentId,
      isAi: true,
      status: isTyping ? "typing" : "idle",
    });
  },
});
