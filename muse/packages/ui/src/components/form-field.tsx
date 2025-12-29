import * as React from "react";
import { cn } from "../lib/utils";

export interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ label, required, error, htmlFor, className, children }, ref) => {
    return (
      <div ref={ref} className={cn("space-y-1.5", className)}>
        <label
          htmlFor={htmlFor}
          className="text-sm font-medium text-mythos-text-secondary"
        >
          {label}
          {required && <span className="text-mythos-accent-red ml-0.5">*</span>}
        </label>
        {children}
        {error && (
          <p className="text-xs text-mythos-accent-red">{error}</p>
        )}
      </div>
    );
  }
);
FormField.displayName = "FormField";

export { FormField };
