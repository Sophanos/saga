import { FileDown, ImageIcon } from "lucide-react";

interface DropHintProps {
  className?: string;
}

/**
 * DropHint - A subtle, whisper-quiet hint for drag-drop functionality.
 *
 * Follows "flow mode" design: unobtrusive at rest, gently reveals on hover.
 * Uses refined editorial typography with soft animations.
 * Portable across web/tauri/expo.
 */
export function DropHint({ className }: DropHintProps) {
  return (
    <div
      className={[
        "mt-6 pt-5 border-t border-mythos-border-subtle",
        "opacity-50 hover:opacity-80 transition-opacity duration-500 ease-out",
        "group cursor-default select-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-center gap-3 text-xs text-mythos-text-muted tracking-wide">
        {/* File import hint */}
        <span className="flex items-center gap-1.5 group-hover:translate-x-0.5 transition-transform duration-300">
          <FileDown className="w-3.5 h-3.5 opacity-60" />
          <span>Drop files to import</span>
        </span>

        {/* Soft divider */}
        <span className="text-mythos-text-muted/30">or</span>

        {/* Image insert hint */}
        <span className="flex items-center gap-1.5 group-hover:-translate-x-0.5 transition-transform duration-300">
          <ImageIcon className="w-3.5 h-3.5 opacity-60" />
          <span>images to insert</span>
        </span>
      </div>
    </div>
  );
}
