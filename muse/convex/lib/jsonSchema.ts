import Ajv, { type ValidateFunction } from "ajv";

export type JsonSchema = Record<string, unknown>;

export type JsonSchemaValidationResult =
  | { ok: true; value: unknown }
  | { ok: false; errors: unknown[]; message: string };

const ajv = new Ajv({
  allErrors: true,
  strict: false,
});

const validatorCache = new Map<string, ValidateFunction>();

function schemaCacheKey(schema: JsonSchema): string {
  try {
    return JSON.stringify(schema);
  } catch {
    return String(schema);
  }
}

export function compileJsonSchema(schema: JsonSchema): ValidateFunction {
  const cacheKey = schemaCacheKey(schema);
  const cached = validatorCache.get(cacheKey);
  if (cached) return cached;

  const validate = ajv.compile(schema);
  validatorCache.set(cacheKey, validate);
  return validate;
}

export function validateJsonSchema(
  schema: JsonSchema,
  data: unknown
): JsonSchemaValidationResult {
  const validate = compileJsonSchema(schema);
  const ok = validate(data);
  if (ok) {
    return { ok: true, value: data };
  }

  const errors = validate.errors ? [...validate.errors] : [];
  const message = ajv.errorsText(validate.errors ?? [], { separator: "; " });

  return {
    ok: false,
    errors,
    message: message || "Schema validation failed",
  };
}

export function validateSchemaDefinition(schema: JsonSchema): JsonSchemaValidationResult {
  const ok = ajv.validateSchema(schema);
  if (ok) {
    return { ok: true, value: schema };
  }

  const errors = ajv.errors ? [...ajv.errors] : [];
  const message = ajv.errorsText(ajv.errors ?? [], { separator: "; " });

  return {
    ok: false,
    errors,
    message: message || "Invalid JSON Schema",
  };
}
