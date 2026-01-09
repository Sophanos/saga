import { getSchema } from "@tiptap/core";
import { WriterKit } from "@mythos/editor";
import { AIGeneratedMark } from "../../packages/editor-webview/src/extensions/ai-generated-mark";
import { BlockIdExtension } from "../../packages/editor-webview/src/extensions/block-id";

export function getEditorSchema() {
  return getSchema([BlockIdExtension, WriterKit, AIGeneratedMark]);
}
