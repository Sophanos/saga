/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai_detect from "../ai/detect.js";
import type * as ai_saga from "../ai/saga.js";
import type * as ai_streams from "../ai/streams.js";
import type * as ai_tools from "../ai/tools.js";
import type * as crons from "../crons.js";
import type * as documents from "../documents.js";
import type * as entities from "../entities.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_embeddings from "../lib/embeddings.js";
import type * as lib_httpAuth from "../lib/httpAuth.js";
import type * as lib_qdrant from "../lib/qdrant.js";
import type * as lib_streaming from "../lib/streaming.js";
import type * as maintenance from "../maintenance.js";
import type * as projects from "../projects.js";
import type * as relationships from "../relationships.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "ai/detect": typeof ai_detect;
  "ai/saga": typeof ai_saga;
  "ai/streams": typeof ai_streams;
  "ai/tools": typeof ai_tools;
  crons: typeof crons;
  documents: typeof documents;
  entities: typeof entities;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/embeddings": typeof lib_embeddings;
  "lib/httpAuth": typeof lib_httpAuth;
  "lib/qdrant": typeof lib_qdrant;
  "lib/streaming": typeof lib_streaming;
  maintenance: typeof maintenance;
  projects: typeof projects;
  relationships: typeof relationships;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
