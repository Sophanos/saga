import type { ResponseFormat } from "../../lib/providers/types";

export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_MODEL = "anthropic/claude-sonnet-4";

type OpenRouterJsonRequest = {
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  temperature?: number;
  apiKeyOverride?: string;
  responseFormat?: ResponseFormat;
  jsonSchema?: unknown;
};

type OpenRouterTextRequest = {
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  temperature?: number;
  apiKeyOverride?: string;
};

export async function callOpenRouterJson<T>(params: OpenRouterJsonRequest): Promise<T> {
  const apiKey = params.apiKeyOverride ?? process.env["OPENROUTER_API_KEY"];
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const responseFormat = params.responseFormat ?? "json_object";
  if (responseFormat === "text") {
    throw new Error("callOpenRouterJson requires a JSON response format");
  }

  let responseFormatPayload: Record<string, unknown>;
  if (responseFormat === "json_schema") {
    if (!params.jsonSchema) {
      throw new Error("jsonSchema is required for json_schema responses");
    }
    responseFormatPayload = { type: "json_schema", json_schema: params.jsonSchema };
  } else {
    responseFormatPayload = { type: responseFormat };
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env["OPENROUTER_SITE_URL"] ?? "https://mythos.app",
      "X-Title": process.env["OPENROUTER_APP_NAME"] ?? "Saga AI",
    },
    body: JSON.stringify({
      model: params.model,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
      response_format: responseFormatPayload,
      temperature: params.temperature ?? 0.3,
      max_tokens: params.maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter returned empty content");
  }

  return JSON.parse(content) as T;
}

export async function callOpenRouterText(params: OpenRouterTextRequest): Promise<string> {
  const apiKey = params.apiKeyOverride ?? process.env["OPENROUTER_API_KEY"];
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env["OPENROUTER_SITE_URL"] ?? "https://mythos.app",
      "X-Title": process.env["OPENROUTER_APP_NAME"] ?? "Saga AI",
    },
    body: JSON.stringify({
      model: params.model,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
      temperature: params.temperature ?? 0.3,
      max_tokens: params.maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter returned empty content");
  }

  return content;
}
