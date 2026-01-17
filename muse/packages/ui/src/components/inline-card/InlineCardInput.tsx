/**
 * InlineCardInput - Chat input for iteration/refinement
 */

import * as React from "react";
import { Send } from "lucide-react";
import { cn } from "../../lib/utils";
import type { InlineCardInputProps } from "./types";

const InlineCardInput = React.forwardRef<HTMLFormElement, InlineCardInputProps>(
  (
    {
      placeholder = "Type to refine...",
      value = "",
      onChange,
      onSubmit,
      disabled = false,
      loading = false,
      accentColor,
      className,
    },
    ref
  ) => {
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!value.trim() || disabled || loading) return;
      onSubmit?.();
    };

    return (
      <form
        ref={ref}
        className={cn(
          "inline-card-input",
          "flex items-center gap-3 px-5 py-4",
          "border-t border-mythos-border-default/50",
          "bg-gradient-to-b from-mythos-bg-tertiary/30 to-mythos-bg-tertiary/50",
          className
        )}
        onSubmit={handleSubmit}
      >
        <input
          type="text"
          className={cn(
            "flex-1 px-4 py-3 rounded-xl",
            "bg-mythos-bg-primary border border-mythos-border-default",
            "text-sm text-mythos-text-primary placeholder:text-mythos-text-muted",
            "outline-none transition-all duration-150",
            "focus:border-[var(--ic-accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--ic-accent)_20%,transparent)]",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          style={
            accentColor ? ({ "--ic-accent": accentColor } as React.CSSProperties) : undefined
          }
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled || loading}
        />
        <button
          type="submit"
          className={cn(
            "flex items-center justify-center w-[38px] h-[38px] rounded-xl shrink-0",
            "bg-[var(--ic-accent)] text-white",
            "shadow-[0_2px_8px_color-mix(in_srgb,var(--ic-accent)_40%,transparent)]",
            "transition-all duration-150",
            "hover:brightness-110 hover:-translate-y-0.5",
            "hover:shadow-[0_4px_12px_color-mix(in_srgb,var(--ic-accent)_50%,transparent)]",
            "disabled:opacity-35 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:translate-y-0",
            loading && "animate-pulse"
          )}
          style={
            accentColor ? ({ "--ic-accent": accentColor } as React.CSSProperties) : undefined
          }
          disabled={!value.trim() || disabled || loading}
        >
          <Send size={14} />
        </button>
      </form>
    );
  }
);
InlineCardInput.displayName = "InlineCardInput";

export { InlineCardInput };
