/// <reference types="vitest/importMeta" />

import { convexTest } from "convex-test";
import { defineSchema, componentsGeneric } from "convex/server";
import type { AgentComponent } from "@convex-dev/agent";
import { register as registerAgentComponent } from "@convex-dev/agent/test";

export const modules = import.meta.glob("../**/*.ts");

export function initConvexTest(schema = defineSchema({})) {
  const t = convexTest(schema, modules);
  registerAgentComponent(t, "agent");
  return t;
}

export const components = componentsGeneric() as unknown as {
  agent: AgentComponent;
};
