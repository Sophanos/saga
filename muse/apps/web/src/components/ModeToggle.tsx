import { BookOpen, Dice5 } from "lucide-react";
import { Button } from "@mythos/ui";
import { useMythosStore } from "../stores";

export function ModeToggle() {
  const mode = useMythosStore((state) => state.ui.mode);
  const setMode = useMythosStore((state) => state.setMode);

  return (
    <div className="flex items-center rounded-md border border-mythos-text-muted/20 p-0.5">
      <Button
        variant={mode === "writer" ? "secondary" : "ghost"}
        size="sm"
        onClick={() => setMode("writer")}
        className={`gap-1.5 rounded-r-none ${
          mode === "writer"
            ? "text-mythos-accent-cyan"
            : "text-mythos-text-muted hover:text-mythos-text-secondary"
        }`}
        title="Writer Mode"
      >
        <BookOpen className="w-4 h-4" />
        <span className="hidden sm:inline text-xs">Writer</span>
      </Button>
      <Button
        variant={mode === "dm" ? "secondary" : "ghost"}
        size="sm"
        onClick={() => setMode("dm")}
        className={`gap-1.5 rounded-l-none ${
          mode === "dm"
            ? "bg-mythos-accent-green/20 text-mythos-accent-green border-mythos-accent-green/30"
            : "text-mythos-text-muted hover:text-mythos-text-secondary"
        }`}
        title="DM Mode"
      >
        <Dice5 className="w-4 h-4" />
        <span className="hidden sm:inline text-xs">DM</span>
      </Button>
    </div>
  );
}
