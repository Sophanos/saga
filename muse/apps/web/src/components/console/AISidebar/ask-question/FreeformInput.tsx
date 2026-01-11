import { TextArea, cn } from "@mythos/ui";

interface FreeformInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Whether an option is selected (dims the freeform area) */
  optionSelected: boolean;
  /** Whether to show "Or type something" label */
  showLabel?: boolean;
}

export function FreeformInput({
  value,
  onChange,
  placeholder = "Type your own answer...",
  disabled,
  optionSelected,
  showLabel = true,
}: FreeformInputProps) {
  return (
    <div className={cn(optionSelected && !value && "opacity-50")}>
      {showLabel && (
        <label className="text-xs text-mythos-text-muted mb-1.5 block">Or type something</label>
      )}
      <TextArea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className="min-h-[60px] text-sm"
      />
    </div>
  );
}
