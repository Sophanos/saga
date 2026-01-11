/**
 * FlowToggleButton - Header button to enter flow mode
 *
 * A zen-like button that invites users into distraction-free writing.
 */

import { Focus } from "lucide-react";
import { Button } from "@mythos/ui";
import { useFlowStore } from "@mythos/state";
import { useMythosStore } from "../../stores";

interface FlowToggleButtonProps {
  /** Optional class name */
  className?: string;
}

export function FlowToggleButton({ className }: FlowToggleButtonProps) {
  const enterFlowMode = useFlowStore((s) => s.enterFlowMode);
  const wordCount = useMythosStore((s) => s.editor.wordCount);

  const handleClick = () => {
    enterFlowMode(wordCount);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`gap-2 ${className ?? ""}`}
      onClick={handleClick}
      data-testid="flow-toggle-button"
      title="Enter Flow Mode (⌘⇧Enter)"
    >
      <Focus className="w-4 h-4" />
      <span className="hidden sm:inline">Flow</span>
    </Button>
  );
}
