import * as React from "react";
import { cn } from "../lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-mythos-border-default bg-mythos-bg-secondary px-3 py-1 text-sm text-mythos-text-primary shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-mythos-text-primary placeholder:text-mythos-text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-mythos-accent-primary disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
