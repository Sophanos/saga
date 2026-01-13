import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config";
import presence from "@convex-dev/presence/convex.config.js";
import prosemirrorSync from "@convex-dev/prosemirror-sync/convex.config.js";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";

const app: ReturnType<typeof defineApp> = defineApp();
app.use(agent);
app.use(prosemirrorSync);
app.use(presence);
app.use(rateLimiter);

export default app;
