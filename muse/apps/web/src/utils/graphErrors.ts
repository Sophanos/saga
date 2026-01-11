export type GraphErrorCode =
  | "INVALID_TYPE"
  | "SCHEMA_VALIDATION_FAILED"
  | "ACCESS_DENIED"
  | "REGISTRY_LOCKED"
  | "LOCK_FAILED_UNKNOWN_TYPES"
  | "INVALID_REGISTRY";

type ParsedGraphError = {
  code: GraphErrorCode;
  detail?: string;
  raw: string;
};

const KNOWN_GRAPH_ERROR_CODES: GraphErrorCode[] = [
  "INVALID_TYPE",
  "SCHEMA_VALIDATION_FAILED",
  "ACCESS_DENIED",
  "REGISTRY_LOCKED",
  "LOCK_FAILED_UNKNOWN_TYPES",
  "INVALID_REGISTRY",
];

function isGraphErrorCode(value: string): value is GraphErrorCode {
  return KNOWN_GRAPH_ERROR_CODES.includes(value as GraphErrorCode);
}

export function parseGraphErrorMessage(message: string): ParsedGraphError | null {
  const [rawCode, ...rest] = message.split(":");
  const code = rawCode?.trim();
  if (!code || !isGraphErrorCode(code)) {
    return null;
  }

  const detail = rest.join(":").trim();
  return {
    code,
    detail: detail.length > 0 ? detail : undefined,
    raw: message,
  };
}

export function formatGraphErrorMessage(
  error: unknown,
  fallback: string
): string {
  const message = error instanceof Error ? error.message : fallback;
  const parsed = parseGraphErrorMessage(message);
  if (!parsed) {
    return message;
  }

  switch (parsed.code) {
    case "INVALID_TYPE":
      return parsed.detail
        ? `Type is not in the registry. ${parsed.detail}`
        : "Type is not in the registry.";
    case "SCHEMA_VALIDATION_FAILED":
      return parsed.detail
        ? `Properties failed schema validation. ${parsed.detail}`
        : "Properties failed schema validation.";
    case "ACCESS_DENIED":
      return "You do not have permission to perform this action.";
    case "REGISTRY_LOCKED":
      return "Registry is locked. Unlock it to make changes.";
    case "LOCK_FAILED_UNKNOWN_TYPES":
      return parsed.detail
        ? `Cannot lock registry: ${parsed.detail}`
        : "Cannot lock registry due to unknown types.";
    case "INVALID_REGISTRY":
      return parsed.detail
        ? `Registry schema is invalid. ${parsed.detail}`
        : "Registry schema is invalid.";
    default:
      return message;
  }
}
