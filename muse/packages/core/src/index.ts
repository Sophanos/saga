// Core domain exports
export * from "./entities";
export * from "./schema";
export * from "./story";
export * from "./dynamics";
export { ProjectGraph } from "./project-graph";
export type { Conflict } from "./project-graph";

// Analysis module
export * from "./analysis";

// Template system
export * from "./templates";

// Template Builder (AI-assisted template creation)
export * from "./templateBuilder";

// Collaboration types
export * from "./collaboration";

// Activity types (for db/state interop)
export * from "./activity";

// Inbox / Captures
export * from "./inbox";

// Genesis types (AI world generation)
export * from "./genesis";

// AI tool types
export * from "./ai";

// Utilities
export * from "./utils";
export * from "./trial/payload";

// Mappers (Convex → Core)
export * from "./mappers";
