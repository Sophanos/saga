import * as React from "react";
import { cn } from "../lib/utils";

export interface TextAreaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
}

const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ value, onChange, placeholder, rows = 3, className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={cn(
          "flex w-full rounded-md border border-mythos-border-default bg-mythos-bg-secondary",
          "px-3 py-2 text-sm text-mythos-text-primary shadow-sm transition-colors",
          "placeholder:text-mythos-text-muted resize-none",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-mythos-accent-primary",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
TextArea.displayName = "TextArea";

export { TextArea };
