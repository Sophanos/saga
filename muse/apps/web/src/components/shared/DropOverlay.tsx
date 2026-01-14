import { Image as ImageIcon } from "lucide-react";
import { accent } from "@mythos/theme";

interface DropOverlayProps {
  visible: boolean;
  label: string;
  className?: string;
  frameClassName?: string;
  showBackdrop?: boolean;
}

export function DropOverlay({
  visible,
  label,
  className,
  frameClassName,
  showBackdrop = false,
}: DropOverlayProps) {
  if (!visible) return null;

  const containerClasses = [
    "absolute inset-0 flex items-center justify-center pointer-events-none",
    showBackdrop ? "bg-mythos-bg-primary/80 backdrop-blur-sm" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const frameClasses = [
    "flex flex-col items-center justify-center rounded-xl px-6 py-4 text-center",
    frameClassName ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClasses}>
      <div
        className={frameClasses}
        style={{
          background: `${accent.primaryBg}80`,
          border: `2px dashed ${accent.primary}`,
        }}
      >
        <ImageIcon className="w-8 h-8 mx-auto mb-2" style={{ color: accent.primary }} />
        <p className="text-sm font-medium" style={{ color: accent.primary }}>
          {label}
        </p>
      </div>
    </div>
  );
}
