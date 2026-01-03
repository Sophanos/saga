import { z } from "npm:zod@4.3.4";

export { z };

const _probe = z.object({ ok: z.boolean() });
if (typeof (_probe as { safeParseAsync?: unknown }).safeParseAsync !== "function") {
  throw new Error(
    "Zod schema is missing safeParseAsync(). The resolved build is likely Zod Core or incompatible."
  );
}
