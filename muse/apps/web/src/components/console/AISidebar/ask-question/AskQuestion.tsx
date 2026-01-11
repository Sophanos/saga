import { useCallback } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@mythos/ui";
import type { AskQuestionArgs, AskQuestionResult } from "@mythos/agent-protocol";
import { useAskQuestionState } from "./useAskQuestionState";
import { QuestionTabs } from "./QuestionTabs";
import { QuestionPanel } from "./QuestionPanel";

interface AskQuestionProps {
  args: AskQuestionArgs;
  onSubmit: (result: AskQuestionResult) => Promise<void>;
  onSkip: () => Promise<void>;
  isSubmitting: boolean;
}

export function AskQuestion({ args, onSubmit, onSkip, isSubmitting }: AskQuestionProps) {
  const { questions, title, description, allowPartialSubmit, submitLabel } = args;
  const isMultiple = questions.length > 1;

  const {
    activeQuestionId,
    setActiveQuestionId,
    answers,
    setAnswer,
    progress,
    canSubmit,
    buildResult,
  } = useAskQuestionState(questions, allowPartialSubmit);

  const activeQuestion = questions.find((q) => q.id === activeQuestionId) ?? questions[0];

  const handleSubmit = useCallback(async () => {
    await onSubmit(buildResult());
  }, [onSubmit, buildResult]);

  const handleSkipCurrent = useCallback(() => {
    if (activeQuestion) {
      setAnswer(activeQuestion.id, { answer: "", skipped: true });
    }
  }, [activeQuestion, setAnswer]);

  const handleSkipAll = useCallback(async () => {
    await onSkip();
  }, [onSkip]);

  // Single question: simpler UI
  if (!isMultiple) {
    const singleQuestion = questions[0];
    const singleAnswer = answers[singleQuestion.id];

    return (
      <div className="space-y-3" data-testid="ask-question-single">
        <QuestionPanel
          question={singleQuestion}
          answer={singleAnswer}
          onAnswer={(answer) => setAnswer(singleQuestion.id, answer)}
          disabled={isSubmitting}
        />

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || !canSubmit}
            className="flex-1 h-7 text-xs gap-1"
            data-testid="tool-approval-accept"
          >
            <Check className="w-3 h-3" />
            {submitLabel ?? "Send Answer"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSkipAll}
            disabled={isSubmitting}
            className="flex-1 h-7 text-xs gap-1"
            data-testid="tool-approval-reject"
          >
            <X className="w-3 h-3" />
            Skip
          </Button>
        </div>
      </div>
    );
  }

  // Multiple questions: full tabbed UI
  return (
    <div className="space-y-3" data-testid="ask-question-multi">
      {/* Header */}
      {(title || description) && (
        <div className="flex items-center justify-between">
          <div>
            {title && (
              <h3 className="text-sm font-medium text-mythos-text-primary">{title}</h3>
            )}
            {description && (
              <p className="text-xs text-mythos-text-muted">{description}</p>
            )}
          </div>
          <span className="text-xs text-mythos-text-muted">
            {progress.answered}/{progress.total}
          </span>
        </div>
      )}

      {/* Tab Navigation */}
      <QuestionTabs
        questions={questions}
        activeId={activeQuestionId}
        answers={answers}
        onSelect={setActiveQuestionId}
      />

      {/* Active Question Panel */}
      {activeQuestion && (
        <QuestionPanel
          question={activeQuestion}
          answer={answers[activeQuestion.id]}
          onAnswer={(answer) => setAnswer(activeQuestion.id, answer)}
          disabled={isSubmitting}
        />
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-mythos-border-default">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSkipCurrent}
          disabled={isSubmitting || answers[activeQuestionId]?.skipped}
          className="h-7 text-xs gap-1"
        >
          Skip this
        </Button>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={handleSkipAll}
          disabled={isSubmitting}
          className="h-7 text-xs gap-1"
          data-testid="tool-approval-reject"
        >
          <X className="w-3 h-3" />
          Skip All
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isSubmitting || !canSubmit}
          className="h-7 text-xs gap-1"
          data-testid="tool-approval-accept"
        >
          <Check className="w-3 h-3" />
          {submitLabel ?? "Submit All"}
        </Button>
      </div>
    </div>
  );
}
