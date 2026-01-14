/**
 * Agent todos persistence.
 *
 * Claude Code style: each write_todos call creates a new record.
 * Latest record per thread is the current state.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

const todoStatusValidator = v.union(
  v.literal("pending"),
  v.literal("in_progress"),
  v.literal("completed")
);

const todoValidator = v.object({
  id: v.string(),
  label: v.string(),
  description: v.optional(v.string()),
  status: todoStatusValidator,
  priority: v.optional(v.string()),
  dependsOn: v.optional(v.array(v.string())),
});

export const createTodos = internalMutation({
  args: {
    projectId: v.id("projects"),
    userId: v.string(),
    threadId: v.optional(v.string()),
    title: v.optional(v.string()),
    todos: v.array(todoValidator),
    target: v.optional(
      v.object({
        documentId: v.optional(v.string()),
        selectionRange: v.optional(
          v.object({
            from: v.number(),
            to: v.number(),
          })
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const todoIds = args.todos.map((todo) => todo.id);
    await ctx.db.insert("agentTodos", {
      projectId: args.projectId,
      userId: args.userId,
      threadId: args.threadId,
      title: args.title,
      todos: args.todos,
      target: args.target,
      createdAt: now,
      updatedAt: now,
    });

    return { todoCount: todoIds.length, stored: true, todoIds };
  },
});

/** Get latest todos for a thread */
export const getByThread = internalQuery({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const todos = await ctx.db
      .query("agentTodos")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .first();
    return todos;
  },
});

/** Get latest todos for a project */
export const getByProject = internalQuery({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const todos = await ctx.db
      .query("agentTodos")
      .withIndex("by_project_createdAt", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .first();
    return todos;
  },
});
