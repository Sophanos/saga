import { useState, useEffect, useCallback } from "react";
import type { ResearchQuestion, QuestionAnswer } from "@mythos/agent-protocol";
import { OptionCard } from "./OptionCard";
import { FreeformInput } from "./FreeformInput";

interface QuestionPanelProps {
  question: ResearchQuestion;
  answer?: QuestionAnswer;
  onAnswer: (answer: QuestionAnswer) => void;
  disabled?: boolean;
}

export function QuestionPanel({ question, answer, onAnswer, disabled }: QuestionPanelProps) {
  const [freeformText, setFreeformText] = useState(
    answer?.optionId ? "" : answer?.answer ?? ""
  );
  const [selectedOptionId, setSelectedOptionId] = useState<string | undefined>(answer?.optionId);

  // Sync local state when answer changes from outside
  useEffect(() => {
    if (answer?.optionId) {
      setSelectedOptionId(answer.optionId);
      setFreeformText("");
    } else if (answer?.answer) {
      setFreeformText(answer.answer);
      setSelectedOptionId(undefined);
    } else {
      setSelectedOptionId(undefined);
      setFreeformText("");
    }
  }, [answer]);

  const handleOptionSelect = useCallback(
    (optionId: string, label: string) => {
      setSelectedOptionId(optionId);
      setFreeformText("");
      onAnswer({ answer: label, optionId });
    },
    [onAnswer]
  );

  const handleFreeformChange = useCallback(
    (text: string) => {
      setFreeformText(text);
      setSelectedOptionId(undefined);
      if (text.trim()) {
        onAnswer({ answer: text.trim() });
      }
    },
    [onAnswer]
  );

  const hasOptions = question.options && question.options.length > 0;

  return (
    <div className="space-y-3">
      {/* Question text */}
      <div>
        <p className="text-sm text-mythos-text-primary font-medium">{question.question}</p>
        {question.detail && (
          <p className="text-xs text-mythos-text-muted mt-1">{question.detail}</p>
        )}
      </div>

      {/* Options */}
      {hasOptions && (
        <div className="space-y-2">
          {question.options!.map((option, idx) => (
            <OptionCard
              key={option.id}
              option={option}
              index={idx}
              isSelected={selectedOptionId === option.id}
              onSelect={() => handleOptionSelect(option.id, option.label)}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {/* Freeform input - always shown */}
      <div className={hasOptions ? "pt-3 border-t border-mythos-border-default" : ""}>
        <FreeformInput
          value={freeformText}
          onChange={handleFreeformChange}
          disabled={disabled}
          optionSelected={!!selectedOptionId}
          showLabel={hasOptions}
          placeholder={hasOptions ? "Type your own answer..." : "Type your answer..."}
        />
      </div>
    </div>
  );
}
