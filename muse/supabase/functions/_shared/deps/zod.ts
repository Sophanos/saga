export { z } from "https://esm.sh/zod@4.3.4?target=deno&pin=v135";

const _probe = z.object({ ok: z.boolean() });
if (typeof (_probe as { safeParseAsync?: unknown }).safeParseAsync !== "function") {
  throw new Error(
    "Zod schema is missing safeParseAsync(). The resolved build is likely Zod Core or incompatible."
  );
}
