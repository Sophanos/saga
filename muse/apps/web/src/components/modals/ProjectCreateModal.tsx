import { useState, useCallback, useEffect } from "react";
import { X, FolderPlus, ChevronDown, Check } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  cn,
} from "@mythos/ui";
import { createProject, createDocument } from "@mythos/db";

// ============================================================================
// Types
// ============================================================================

type Genre = "fantasy" | "scifi" | "literary" | "mystery" | "romance" | "horror" | "thriller";

interface ProjectFormData {
  name: string;
  description: string;
  genre: Genre | "";
}

interface ProjectCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (projectId: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const GENRE_OPTIONS: { value: Genre; label: string }[] = [
  { value: "fantasy", label: "Fantasy" },
  { value: "scifi", label: "Science Fiction" },
  { value: "literary", label: "Literary Fiction" },
  { value: "mystery", label: "Mystery" },
  { value: "romance", label: "Romance" },
  { value: "horror", label: "Horror" },
  { value: "thriller", label: "Thriller" },
];

const EMPTY_TIPTAP_DOC = { type: "doc", content: [{ type: "paragraph" }] };

// ============================================================================
// Helper Components
// ============================================================================

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}

function FormField({ label, required, error, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-mythos-text-secondary">
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

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function Select({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled,
  className,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between w-full h-9 px-3 py-1 rounded-md text-sm",
          "border border-mythos-text-muted/30 bg-mythos-bg-secondary",
          "hover:bg-mythos-bg-tertiary transition-colors",
          "focus:outline-none focus:ring-1 focus:ring-mythos-accent-cyan",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <span className={selectedOption ? "text-mythos-text-primary" : "text-mythos-text-muted"}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-mythos-text-muted" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <ul
            className={cn(
              "absolute z-20 mt-1 w-full max-h-60 overflow-auto py-1 rounded-md",
              "bg-mythos-bg-secondary border border-mythos-text-muted/30",
              "shadow-lg shadow-black/20"
            )}
          >
            {options.map((option) => (
              <li
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex items-center justify-between px-3 py-2 cursor-pointer",
                  "text-sm text-mythos-text-secondary",
                  "hover:bg-mythos-bg-tertiary",
                  option.value === value && "bg-mythos-bg-tertiary"
                )}
              >
                <span>{option.label}</span>
                {option.value === value && (
                  <Check className="w-4 h-4 text-mythos-accent-cyan" />
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

interface TextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

function TextArea({ value, onChange, placeholder, rows = 3, className }: TextAreaProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={cn(
        "flex w-full rounded-md border border-mythos-text-muted/30 bg-mythos-bg-secondary",
        "px-3 py-2 text-sm text-mythos-text-primary shadow-sm transition-colors",
        "placeholder:text-mythos-text-muted resize-none",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-mythos-accent-cyan",
        className
      )}
    />
  );
}

// ============================================================================
// Main Modal Component
// ============================================================================

const initialFormData: ProjectFormData = {
  name: "",
  description: "",
  genre: "",
};

export function ProjectCreateModal({
  isOpen,
  onClose,
  onCreated,
}: ProjectCreateModalProps) {
  const [formData, setFormData] = useState<ProjectFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(initialFormData);
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const updateFormData = useCallback((updates: Partial<ProjectFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    // Clear errors for updated fields
    const fieldNames = Object.keys(updates);
    setErrors((prev) => {
      const next = { ...prev };
      fieldNames.forEach((f) => delete next[f]);
      return next;
    });
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors["name"] = "Project name is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate() || isSubmitting) return;

      setIsSubmitting(true);

      try {
        // Create the project
        const project = await createProject({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          genre: formData.genre || null,
        });

        // Create an initial empty document
        await createDocument({
          project_id: project.id,
          type: "chapter",
          title: "Chapter 1",
          content: EMPTY_TIPTAP_DOC,
          content_text: "",
          order_index: 0,
          word_count: 0,
        });

        onCreated(project.id);
      } catch (error) {
        console.error("Failed to create project:", error);
        setErrors({
          submit: error instanceof Error ? error.message : "Failed to create project",
        });
        setIsSubmitting(false);
      }
    },
    [formData, validate, isSubmitting, onCreated]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    },
    [onClose, isSubmitting]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-create-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-mythos-bg-primary/80 backdrop-blur-sm"
        onClick={isSubmitting ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <Card className="relative z-10 w-full max-w-md mx-4 shadow-xl border-mythos-text-muted/30">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-mythos-accent-cyan" />
              <CardTitle id="project-create-title" className="text-lg">
                Create New Project
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-8 w-8 text-mythos-text-muted hover:text-mythos-text-primary"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <CardDescription className="pt-1">
            Start a new writing project. Choose a genre to get tailored suggestions.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pb-4">
            {/* Project Name */}
            <FormField label="Project Name" required error={errors["name"]}>
              <Input
                value={formData.name}
                onChange={(e) => updateFormData({ name: e.target.value })}
                placeholder="Enter project name..."
                autoFocus
                disabled={isSubmitting}
              />
            </FormField>

            {/* Genre */}
            <FormField label="Genre">
              <Select
                value={formData.genre}
                onChange={(v) => updateFormData({ genre: v as Genre | "" })}
                options={GENRE_OPTIONS}
                placeholder="Select a genre..."
                disabled={isSubmitting}
              />
            </FormField>

            {/* Description */}
            <FormField label="Description">
              <TextArea
                value={formData.description}
                onChange={(v) => updateFormData({ description: v })}
                placeholder="A brief description of your project..."
                rows={3}
              />
            </FormField>

            {/* Submit Error */}
            {errors["submit"] && (
              <div className="p-3 rounded-md bg-mythos-accent-red/10 border border-mythos-accent-red/30">
                <p className="text-sm text-mythos-accent-red">{errors["submit"]}</p>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-between gap-2 pt-4 border-t border-mythos-text-muted/20">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="gap-1.5 min-w-[120px]"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <FolderPlus className="w-4 h-4" />
                  Create Project
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export type { ProjectCreateModalProps };
