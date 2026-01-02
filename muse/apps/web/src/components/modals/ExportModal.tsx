import { useState, useCallback, useEffect } from "react";
import { X, FileDown, FileText, FileType, BookOpen, File } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@mythos/ui";
import { useStoryExporter } from "../../hooks/useStoryExporter";
import { type ExportFormat, type ExportOptions } from "../../services/export";
import type { EntityType } from "@mythos/core";

// ============================================================================
// Types
// ============================================================================

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormatOption {
  id: ExportFormat;
  label: string;
  icon: React.ReactNode;
  description: string;
}

// ============================================================================
// Constants
// ============================================================================

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: "markdown",
    label: "Markdown",
    icon: <FileText className="w-5 h-5" />,
    description: "Plain text with formatting. Great for version control.",
  },
  {
    id: "docx",
    label: "Word",
    icon: <FileType className="w-5 h-5" />,
    description: "Microsoft Word format. Best for editing and sharing.",
  },
  {
    id: "pdf",
    label: "PDF",
    icon: <File className="w-5 h-5" />,
    description: "Portable format. Best for printing and distribution.",
  },
  {
    id: "epub",
    label: "EPUB",
    icon: <BookOpen className="w-5 h-5" />,
    description: "E-book format. Compatible with most e-readers.",
  },
];

const ENTITY_TYPE_OPTIONS: { value: EntityType; label: string }[] = [
  { value: "character", label: "Characters" },
  { value: "location", label: "Locations" },
  { value: "item", label: "Items" },
  { value: "faction", label: "Factions" },
  { value: "magic_system", label: "Magic Systems" },
  { value: "event", label: "Events" },
  { value: "concept", label: "Concepts" },
];

// ============================================================================
// Main Component
// ============================================================================

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const { exportStory, isExporting, error, clearError, canExport } =
    useStoryExporter();

  // Form state
  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [includeTitlePage, setIncludeTitlePage] = useState(true);
  const [includeToc, setIncludeToc] = useState(true);
  const [includeGlossary, setIncludeGlossary] = useState(true);
  const [glossaryTypes, setGlossaryTypes] = useState<EntityType[]>([
    "character",
    "location",
  ]);
  const [onlyReferenced, setOnlyReferenced] = useState(true);
  const [preserveEntityMarks, setPreserveEntityMarks] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormat("markdown");
      setIncludeTitlePage(true);
      setIncludeToc(true);
      setIncludeGlossary(true);
      setGlossaryTypes(["character", "location"]);
      setOnlyReferenced(true);
      setPreserveEntityMarks(false);
      clearError();
    }
  }, [isOpen, clearError]);

  const handleExport = useCallback(async () => {
    const options: ExportOptions = {
      format,
      includeTitlePage,
      includeToc,
      preserveEntityMarks,
      glossary: {
        include: includeGlossary,
        types: glossaryTypes,
        onlyReferenced,
      },
    };

    await exportStory(options);

    // Close modal on success (no error means success)
    if (!error) {
      onClose();
    }
  }, [
    format,
    includeTitlePage,
    includeToc,
    preserveEntityMarks,
    includeGlossary,
    glossaryTypes,
    onlyReferenced,
    exportStory,
    error,
    onClose,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && !isExporting) {
        onClose();
      }
    },
    [onClose, isExporting]
  );

  const toggleGlossaryType = useCallback((type: EntityType) => {
    setGlossaryTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-mythos-bg-primary/80 backdrop-blur-sm"
        onClick={isExporting ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <Card className="relative z-10 w-full max-w-lg mx-4 shadow-xl border-mythos-border-default max-h-[90vh] overflow-y-auto">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileDown className="w-5 h-5 text-mythos-accent-primary" />
              <CardTitle id="export-modal-title" className="text-lg">
                Export Story
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={isExporting}
              className="h-8 w-8 text-mythos-text-muted hover:text-mythos-text-primary"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <CardDescription className="pt-1">
            Export your story to your preferred format.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pb-4">
          {/* Format Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-mythos-text-primary">
              Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              {FORMAT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFormat(option.id)}
                  disabled={isExporting}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg border text-left transition-colors
                    ${
                      format === option.id
                        ? "border-mythos-accent-primary bg-mythos-accent-primary/10 text-mythos-text-primary"
                        : "border-mythos-border-default hover:border-mythos-text-muted/40 text-mythos-text-secondary"
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  <div
                    className={
                      format === option.id
                        ? "text-mythos-accent-primary"
                        : "text-mythos-text-muted"
                    }
                  >
                    {option.icon}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{option.label}</div>
                    <div className="text-xs text-mythos-text-muted">
                      {option.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Document Options */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-mythos-text-primary">
              Document Options
            </label>

            <Checkbox
              id="include-title"
              checked={includeTitlePage}
              onChange={setIncludeTitlePage}
              disabled={isExporting}
              label="Include title page"
            />

            <Checkbox
              id="include-toc"
              checked={includeToc}
              onChange={setIncludeToc}
              disabled={isExporting}
              label="Include table of contents"
            />

            <Checkbox
              id="preserve-marks"
              checked={preserveEntityMarks}
              onChange={setPreserveEntityMarks}
              disabled={isExporting}
              label="Preserve entity highlighting"
              description="Keep visual markers for character and location mentions"
            />
          </div>

          {/* Glossary Options */}
          <div className="space-y-3">
            <Checkbox
              id="include-glossary"
              checked={includeGlossary}
              onChange={setIncludeGlossary}
              disabled={isExporting}
              label="Include glossary"
              labelClassName="font-medium"
            />

            {includeGlossary && (
              <div className="ml-6 space-y-3 pt-1">
                <div className="space-y-2">
                  <label className="text-xs text-mythos-text-muted">
                    Entity types to include:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {ENTITY_TYPE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => toggleGlossaryType(option.value)}
                        disabled={isExporting}
                        className={`
                          px-2 py-1 text-xs rounded-md border transition-colors
                          ${
                            glossaryTypes.includes(option.value)
                              ? "border-mythos-accent-primary bg-mythos-accent-primary/10 text-mythos-accent-primary"
                              : "border-mythos-border-default text-mythos-text-muted hover:border-mythos-text-muted/50"
                          }
                          disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Checkbox
                  id="only-referenced"
                  checked={onlyReferenced}
                  onChange={setOnlyReferenced}
                  disabled={isExporting}
                  label="Only include referenced entities"
                  description="Exclude entities not mentioned in the story"
                />
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 rounded-md bg-mythos-accent-red/10 border border-mythos-accent-red/30">
              <p className="text-sm text-mythos-accent-red">{error}</p>
            </div>
          )}

          {/* Warning if can't export */}
          {!canExport && (
            <div className="p-3 rounded-md bg-mythos-accent-yellow/10 border border-mythos-accent-yellow/30">
              <p className="text-sm text-mythos-accent-yellow">
                No project or documents available to export.
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between gap-2 pt-4 border-t border-mythos-border-default">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || !canExport}
            className="gap-1.5 min-w-[120px]"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4" />
                Export
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// ============================================================================
// Checkbox Component
// ============================================================================

interface CheckboxProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
  labelClassName?: string;
  description?: string;
}

function Checkbox({
  id,
  checked,
  onChange,
  disabled,
  label,
  labelClassName,
  description,
}: CheckboxProps) {
  return (
    <div className="flex items-start gap-2">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-1 w-4 h-4 rounded border-mythos-border-default text-mythos-accent-primary focus:ring-mythos-accent-primary focus:ring-offset-mythos-bg-primary bg-mythos-bg-secondary disabled:opacity-50"
      />
      <div>
        <label
          htmlFor={id}
          className={`text-sm text-mythos-text-primary cursor-pointer ${labelClassName ?? ""}`}
        >
          {label}
        </label>
        {description && (
          <p className="text-xs text-mythos-text-muted">{description}</p>
        )}
      </div>
    </div>
  );
}


