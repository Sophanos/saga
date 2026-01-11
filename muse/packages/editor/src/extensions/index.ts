export { EntityMark, type EntityMarkOptions } from "./entity-mark";
export { AIGeneratedMark, type AIGeneratedMarkOptions } from "./ai-generated-mark";
export { ExecutionMarker, type ExecutionMarkerOptions } from "./execution-marker";
export { AppliedHighlight } from "./applied-highlight";
export {
  EntitySuggestion,
  type EntitySuggestionOptions,
  createSuggestionItems,
} from "./entity-suggestion";
export {
  LinterDecoration,
  type LinterDecorationOptions,
  type LinterIssue,
} from "./linter-decoration";
export {
  PasteHandler,
  type PasteHandlerOptions,
  pasteHandlerPluginKey,
} from "./paste-handler";
export { SceneBlock, type SceneBlockOptions } from "./scene-block";
export { SceneList, type SceneListOptions } from "./scene-list";
export {
  SlashCommand,
  slashCommandPluginKey,
  defaultSlashCommandItems,
  filterSlashCommandItems,
  groupByCategory,
  type SlashCommandOptions,
  type SlashCommandItem,
} from "./slash-command";
export {
  StyleDecoration,
  type StyleDecorationOptions,
  styleDecorationPluginKey,
} from "./style-decoration";

// Writer-focused extensions
export { WriterKit, type WriterKitOptions } from "./writer-kit";
export {
  taskListExtensions,
  TaskList,
  TaskItem,
  type TaskListOptions,
} from "./task-list";
export { imageExtension, Image, type ImageOptions } from "./image";
export {
  tableExtensions,
  Table,
  TableRow,
  TableHeader,
  TableCell,
  type TableOptions,
} from "./table";
export {
  formattingExtensions,
  Underline,
  TextStyle,
  Color,
  Highlight,
  type FormattingOptions,
} from "./formatting";

// AI inline editing
export {
  AIBlock,
  type AIBlockOptions,
  type AIBlockAttributes,
  type AIBlockStatus,
} from "./ai-block";
