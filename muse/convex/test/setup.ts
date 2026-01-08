/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { defineSchema, componentsGeneric } from "convex/server";
import type { AgentComponent } from "@convex-dev/agent";
import { schema as agentComponentSchema } from "@convex-dev/agent/dist/component/schema.js";

export const modules = import.meta.glob("../**/*.ts");
export const componentModules = import.meta.glob(
  "../../node_modules/@convex-dev/agent/dist/component/**/*.js"
);

export function initConvexTest(schema = defineSchema({})) {
  const t = convexTest(schema, modules);
  t.registerComponent("agent", agentComponentSchema, componentModules);
  return t;
}

export const components = componentsGeneric() as unknown as {
  agent: AgentComponent;
};
