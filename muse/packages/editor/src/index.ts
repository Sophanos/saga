// Extensions
export * from "./extensions";

// Fixes
export * from "./fixes";

// Re-export commonly used Tiptap items
export { useEditor, EditorContent } from "@tiptap/react";
export { Extension, Mark, Node } from "@tiptap/core";
export type { Editor } from "@tiptap/core";
export { default as StarterKit } from "@tiptap/starter-kit";
export { default as Placeholder } from "@tiptap/extension-placeholder";
