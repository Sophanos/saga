import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";

export interface TaskListOptions {
  nested?: boolean;
  itemTypeName?: string;
}

export const taskListExtensions = (options: TaskListOptions = {}) => [
  TaskList.configure({
    itemTypeName: options.itemTypeName ?? "taskItem",
  }),
  TaskItem.configure({
    nested: options.nested ?? true,
  }),
];

export { TaskList, TaskItem };
