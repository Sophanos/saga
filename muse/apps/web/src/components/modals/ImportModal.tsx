import { useState, useCallback, useEffect, useRef } from "react";
import {
  X,
  FileUp,
  FileText,
  FileType,
  BookOpen,
  File,
  Upload,
  AlertCircle,
} from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@mythos/ui";
import { useStoryImporter } from "../../hooks/useStoryImporter";
import {
  type ImportFormat,
  type ImportFormatSelection,
  type ImportMode,
  IMPORT_FORMAT_METADATA,
} from "../../services/import";
import { validateImportFile, detectFormatFromFile } from "../../services/import/utils";
import type { EntityType } from "@mythos/core";

// ============================================================================
// Types
// ============================================================================

export interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormatOption {
  id: ImportFormatSelection;
  label: string;
  icon: React.ReactNode;
  description: string;
}

// ============================================================================
// Constants
// ============================================================================

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: "auto",
    label: "Auto-detect",
    icon: <File className="w-5 h-5" />,
    description: "Automatically detect format from file extension.",
  },
  {
    id: "markdown",
    label: "Markdown",
    icon: <FileText className="w-5 h-5" />,
    description: "Import .md or .markdown files.",
  },
  {
    id: "docx",
    label: "Word",
    icon: <FileType className="w-5 h-5" />,
    description: "Import Microsoft Word .docx files.",
  },
  {
    id: "epub",
    label: "EPUB",
    icon: <BookOpen className="w-5 h-5" />,
    description: "Import e-book .epub files.",
  },
  {
    id: "plaintext",
    label: "Plain Text",
    icon: <File className="w-5 h-5" />,
    description: "Import .txt files without formatting.",
  },
];

const ENTITY_TYPE_OPTIONS: { value: EntityType; label: string }[] = [
  { value: "character", label: "Characters" },
  { value: "location", label: "Locations" },
  { value: "item", label: "Items" },
  { value: "faction", label: "Factions" },
];

const ACCEPTED_EXTENSIONS = ".md,.markdown,.mdown,.mkd,.docx,.epub,.txt,.text";

// ============================================================================
// Main Component
// ============================================================================

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const {
    importStory,
    isImporting,
    progress,
    error,
    clearError,
    canImport,
    cancel,
  } = useStoryImporter();

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<ImportFormatSelection>("auto");
  const [mode, setMode] = useState<ImportMode>("append");
  const [detectEntities, setDetectEntities] = useState(false);
  const [entityTypes, setEntityTypes] = useState<EntityType[]>([
    "character",
    "location",
  ]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<ImportFormat | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setFormat("auto");
      setMode("append");
      setDetectEntities(false);
      setEntityTypes(["character", "location"]);
      setFileError(null);
      setDetectedFormat(null);
      clearError();
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [isOpen, clearError]);

  // Handle file selection
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0] ?? null;
      setFile(selectedFile);
      setFileError(null);
      setDetectedFormat(null);

      if (selectedFile) {
        // Validate file
        const validation = validateImportFile(selectedFile);
        if (!validation.valid) {
          setFileError(validation.error ?? "Invalid file");
          return;
        }

        // Detect format for display
        const detected = detectFormatFromFile(selectedFile);
        setDetectedFormat(detected);
      }
    },
    []
  );

  // Handle drop zone
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        setFile(droppedFile);
        setFileError(null);
        setDetectedFormat(null);

        const validation = validateImportFile(droppedFile);
        if (!validation.valid) {
          setFileError(validation.error ?? "Invalid file");
          return;
        }

        const detected = detectFormatFromFile(droppedFile);
        setDetectedFormat(detected);
      }
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Handle import
  const handleImport = useCallback(async () => {
    if (!file) {
      setFileError("Please select a file to import");
      return;
    }

    const result = await importStory(file, {
      format,
      mode,
      detectEntities,
      entityTypes,
    });

    // Close modal on success
    if (result) {
      onClose();
    }
  }, [file, format, mode, detectEntities, entityTypes, importStory, onClose]);

  // Handle keyboard
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && !isImporting) {
        onClose();
      }
    },
    [onClose, isImporting]
  );

  // Toggle entity type
  const toggleEntityType = useCallback((type: EntityType) => {
    setEntityTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }, []);

  // Handle cancel during import
  const handleCancel = useCallback(() => {
    if (isImporting) {
      cancel();
    } else {
      onClose();
    }
  }, [isImporting, cancel, onClose]);

  if (!isOpen) return null;

  const displayedError = fileError ?? error;
  const canStartImport = file && !fileError && canImport && !isImporting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-mythos-bg-primary/80 backdrop-blur-sm"
        onClick={isImporting ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <Card className="relative z-10 w-full max-w-lg mx-4 shadow-xl border-mythos-border-default max-h-[90vh] overflow-y-auto">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileUp className="w-5 h-5 text-mythos-accent-primary" />
              <CardTitle id="import-modal-title" className="text-lg">
                Import Story
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancel}
              className="h-8 w-8 text-mythos-text-muted hover:text-mythos-text-primary"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <CardDescription className="pt-1">
            Import a story from Markdown, Word, EPUB, or plain text files.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pb-4">
          {/* File Drop Zone */}
          <div
            className={`
              relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
              transition-colors
              ${file
                ? "border-mythos-accent-primary bg-mythos-accent-primary/5"
                : "border-mythos-border-default hover:border-mythos-text-muted/50"
              }
              ${isImporting ? "pointer-events-none opacity-50" : ""}
            `}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={handleFileChange}
              className="hidden"
              disabled={isImporting}
            />

            {file ? (
              <div className="space-y-2">
                <FileText className="w-10 h-10 mx-auto text-mythos-accent-primary" />
                <p className="text-sm font-medium text-mythos-text-primary">
                  {file.name}
                </p>
                <p className="text-xs text-mythos-text-muted">
                  {detectedFormat
                    ? `Detected: ${IMPORT_FORMAT_METADATA[detectedFormat].label}`
                    : "Click or drop to replace"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-10 h-10 mx-auto text-mythos-text-muted" />
                <p className="text-sm text-mythos-text-secondary">
                  Click to select or drag and drop
                </p>
                <p className="text-xs text-mythos-text-muted">
                  Supports: .md, .docx, .epub, .txt
                </p>
              </div>
            )}
          </div>

          {/* Format Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-mythos-text-primary">
              Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              {FORMAT_OPTIONS.slice(0, 3).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFormat(option.id)}
                  disabled={isImporting}
                  className={`
                    flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition-colors
                    ${format === option.id
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
                  <div className="text-xs font-medium">{option.label}</div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {FORMAT_OPTIONS.slice(3).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFormat(option.id)}
                  disabled={isImporting}
                  className={`
                    flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition-colors
                    ${format === option.id
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
                  <div className="text-xs font-medium">{option.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Import Mode */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-mythos-text-primary">
              Import Mode
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("append")}
                disabled={isImporting}
                className={`
                  flex-1 px-3 py-2 rounded-lg border text-sm transition-colors
                  ${mode === "append"
                    ? "border-mythos-accent-primary bg-mythos-accent-primary/10 text-mythos-text-primary"
                    : "border-mythos-border-default hover:border-mythos-text-muted/40 text-mythos-text-secondary"
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                <div className="font-medium">Append</div>
                <div className="text-xs text-mythos-text-muted">
                  Add to existing documents
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMode("replace")}
                disabled={isImporting}
                className={`
                  flex-1 px-3 py-2 rounded-lg border text-sm transition-colors
                  ${mode === "replace"
                    ? "border-mythos-accent-red bg-mythos-accent-red/10 text-mythos-text-primary"
                    : "border-mythos-border-default hover:border-mythos-text-muted/40 text-mythos-text-secondary"
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                <div className="font-medium">Replace</div>
                <div className="text-xs text-mythos-text-muted">
                  Replace all documents
                </div>
              </button>
            </div>
            {mode === "replace" && (
              <div className="flex items-start gap-2 p-2 rounded-md bg-mythos-accent-yellow/10 border border-mythos-accent-yellow/30">
                <AlertCircle className="w-4 h-4 text-mythos-accent-yellow mt-0.5 flex-shrink-0" />
                <p className="text-xs text-mythos-accent-yellow">
                  This will replace all existing documents in the project.
                </p>
              </div>
            )}
          </div>

          {/* Entity Detection */}
          <div className="space-y-3">
            <Checkbox
              id="detect-entities"
              checked={detectEntities}
              onChange={setDetectEntities}
              disabled={isImporting}
              label="Detect entities during import"
              labelClassName="font-medium"
              description="Use AI to find characters, locations, and other entities"
            />

            {detectEntities && (
              <div className="ml-6 space-y-2 pt-1">
                <label className="text-xs text-mythos-text-muted">
                  Entity types to detect:
                </label>
                <div className="flex flex-wrap gap-2">
                  {ENTITY_TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleEntityType(option.value)}
                      disabled={isImporting}
                      className={`
                        px-2 py-1 text-xs rounded-md border transition-colors
                        ${entityTypes.includes(option.value)
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
            )}
          </div>

          {/* Progress */}
          {isImporting && progress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-mythos-text-secondary">
                  {progress.message}
                </span>
                <span className="text-mythos-text-muted">{progress.percent}%</span>
              </div>
              <div className="h-2 bg-mythos-bg-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full bg-mythos-accent-primary transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Display */}
          {displayedError && (
            <div className="p-3 rounded-md bg-mythos-accent-red/10 border border-mythos-accent-red/30">
              <p className="text-sm text-mythos-accent-red">{displayedError}</p>
            </div>
          )}

          {/* Warning if can't import */}
          {!canImport && (
            <div className="p-3 rounded-md bg-mythos-accent-yellow/10 border border-mythos-accent-yellow/30">
              <p className="text-sm text-mythos-accent-yellow">
                No project selected. Please select or create a project first.
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between gap-2 pt-4 border-t border-mythos-border-default">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
          >
            {isImporting ? "Cancel" : "Close"}
          </Button>
          <Button
            onClick={handleImport}
            disabled={!canStartImport}
            className="gap-1.5 min-w-[120px]"
          >
            {isImporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <FileUp className="w-4 h-4" />
                Import
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
