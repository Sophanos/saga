/**
 * @mythos/api-client
 * Platform-agnostic API client for Mythos services
 */

export { ApiClient } from "./base";
export type {
  ApiClientConfig,
  ApiResponse,
  ApiError,
  ApiResult,
} from "./base";

export { AIClient } from "./ai";
export type { AIClientConfig } from "./ai";
export {
  LinterResponseSchema,
  CoachResponseSchema,
  DetectResponseSchema,
  DynamicsResponseSchema,
} from "./ai";

/**
 * Create a configured AI client for the given environment
 */
export function createAIClient(config: {
  supabaseUrl: string;
  apiKey?: string;
}) {
  const { AIClient } = require("./ai");
  return new AIClient({
    baseUrl: config.supabaseUrl,
    apiKey: config.apiKey,
  });
}
