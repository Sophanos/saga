/**
 * TodoListCard
 *
 * Renders write_todos tool result as a checklist.
 * Claude Code style - agent manages full state.
 */

import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "@mythos/ui";
import type { WriteTodosArgs, TodoItem, TodoStatus } from "@mythos/agent-protocol";

interface TodoListCardProps {
  args: WriteTodosArgs;
  className?: string;
}

function getStatusIcon(status: TodoStatus) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-4 h-4 text-mythos-accent-green" />;
    case "in_progress":
      return <Loader2 className="w-4 h-4 text-mythos-accent-primary animate-spin" />;
    case "pending":
    default:
      return <Circle className="w-4 h-4 text-mythos-text-muted" />;
  }
}

function getPriorityBadge(priority?: string) {
  if (!priority || priority === "medium") return null;
  return (
    <span
      className={cn(
        "text-[9px] px-1 py-0.5 rounded font-medium",
        priority === "high"
          ? "bg-mythos-accent-red/20 text-mythos-accent-red"
          : "bg-mythos-text-muted/20 text-mythos-text-muted"
      )}
    >
      {priority}
    </span>
  );
}

function TodoItemRow({ todo }: { todo: TodoItem }) {
  const isCompleted = todo.status === "completed";

  return (
    <div
      className={cn(
        "flex items-start gap-2 py-1.5",
        isCompleted && "opacity-60"
      )}
    >
      <div className="mt-0.5 flex-shrink-0">{getStatusIcon(todo.status)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "text-sm text-mythos-text-primary",
              isCompleted && "line-through"
            )}
          >
            {todo.label}
          </span>
          {getPriorityBadge(todo.priority)}
        </div>
        {todo.description && (
          <p className="text-xs text-mythos-text-muted mt-0.5 line-clamp-2">
            {todo.description}
          </p>
        )}
      </div>
    </div>
  );
}

export function TodoListCard({ args, className }: TodoListCardProps) {
  const { title, todos } = args;

  const completed = todos.filter((t) => t.status === "completed").length;
  const inProgress = todos.filter((t) => t.status === "in_progress").length;
  const pending = todos.filter((t) => t.status === "pending").length;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header */}
      {title && (
        <div className="text-xs font-medium text-mythos-text-primary">{title}</div>
      )}

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-mythos-bg-tertiary rounded-full overflow-hidden">
          <div
            className="h-full bg-mythos-accent-green transition-all"
            style={{ width: `${(completed / todos.length) * 100}%` }}
          />
        </div>
        <span className="text-[10px] text-mythos-text-muted tabular-nums">
          {completed}/{todos.length}
        </span>
      </div>

      {/* Stats */}
      <div className="flex gap-3 text-[10px]">
        {inProgress > 0 && (
          <span className="text-mythos-accent-primary">{inProgress} in progress</span>
        )}
        {pending > 0 && (
          <span className="text-mythos-text-muted">{pending} pending</span>
        )}
        {completed > 0 && (
          <span className="text-mythos-accent-green">{completed} done</span>
        )}
      </div>

      {/* Todo list */}
      <div className="space-y-0.5 max-h-48 overflow-y-auto">
        {todos.map((todo) => (
          <TodoItemRow key={todo.id} todo={todo} />
        ))}
      </div>
    </div>
  );
}
