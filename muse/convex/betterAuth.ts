/**
 * Better Auth Configuration for Mythos
 *
 * Centralized authentication using Better Auth with Convex.
 * Supports:
 * - Email/password authentication
 * - Social login (Apple, Google)
 * - Cross-platform sessions (Expo, Tauri, Web)
 *
 * @see https://labs.convex.dev/better-auth
 */

import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import { expo } from "@better-auth/expo";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import authConfig from "./auth.config";

/**
 * Better Auth component client
 */
export const authComponent = createClient<DataModel>(components.betterAuth);

/**
 * Site URLs for different environments
 */
const getSiteUrl = (): string => {
  const siteUrl = process.env["SITE_URL"];
  if (!siteUrl) {
    console.warn("[better-auth] SITE_URL not set; defaulting to https://cascada.vision");
  }
  return siteUrl ?? "https://cascada.vision";
};

/**
 * Create Better Auth instance
 * Called for each request to ensure fresh context
 */
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  const siteUrl = getSiteUrl();

  return betterAuth({
    // Secret for signing tokens
    secret: process.env["BETTER_AUTH_SECRET"],

    // Trusted origins for CORS and redirects
    trustedOrigins: [
      siteUrl,
      // Expo deep links
      "mythos://",
      "mythos://auth/callback",
      "exp://", // Expo Go development
      // Tauri
      "tauri://localhost",
      "https://tauri.localhost",
      // Development
      "http://localhost:3000",
      "http://localhost:1420",
      "http://localhost:8081",
      "http://localhost:8082",
      "http://localhost:8083",
      "http://localhost:19006",
    ],

    // Database adapter (Convex)
    database: authComponent.adapter(ctx),

    // Email/password auth
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // Enable in production
      minPasswordLength: 8,
    },

    // Social providers (configure in environment)
    socialProviders: {
      apple: {
        clientId: process.env["APPLE_CLIENT_ID"]!,
        clientSecret: process.env["APPLE_CLIENT_SECRET"]!,
      },
      google: {
        clientId: process.env["GOOGLE_CLIENT_ID"]!,
        clientSecret: process.env["GOOGLE_CLIENT_SECRET"]!,
      },
    },

    // Session configuration
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // Update session every 24 hours
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 minutes cache
      },
    },

    // Rate limiting
    rateLimit: {
      enabled: true,
      window: 60, // 1 minute
      max: 100, // 100 requests per minute
    },

    // Plugins
    plugins: [
      // Expo support for mobile
      expo(),
      // Convex integration
      convex({ authConfig }),
      // Cross-domain support for Tauri/Web
      crossDomain({ siteUrl }),
    ],

  });
};

/**
 * Get the current authenticated user
 * Use in Convex queries/mutations
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx);
  },
});

/**
 * Internal query to get user by ID
 */
export const getUserById = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users" as any)
      .filter((q: any) => q.eq(q.field("id"), args.userId))
      .first();
    return users;
  },
});

/**
 * Get user's subscription status
 */
export const getUserSubscription = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return null;

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "active")
      )
      .first();

    return subscription;
  },
});

/**
 * Check if user has a specific entitlement
 */
export const hasEntitlement = query({
  args: {
    entitlement: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return false;

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "active")
      )
      .first();

    if (!subscription) return false;

    return subscription.entitlements.includes(args.entitlement);
  },
});
