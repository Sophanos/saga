/// <reference types="vitest/importMeta" />

import { createRequire } from "module";
import { convexTest } from "convex-test";
import { defineSchema, componentsGeneric } from "convex/server";
import type { AgentComponent } from "@convex-dev/agent";

declare global {
  interface ImportMeta {
    glob: (pattern: string) => Record<string, unknown>;
  }
}

const require = createRequire(import.meta.url);
const { register: registerAgentComponent } = require("@convex-dev/agent/test") as {
  register: (t: unknown, name?: string) => void;
};

type ModuleMap = Record<string, () => Promise<unknown>>;

export const modules = import.meta.glob("../**/*.ts") as ModuleMap;

export function initConvexTest(schema = defineSchema({})) {
  const t = convexTest(schema, modules);
  registerAgentComponent(t, "agent");
  return t;
}

export const components = componentsGeneric() as unknown as {
  agent: AgentComponent;
};
