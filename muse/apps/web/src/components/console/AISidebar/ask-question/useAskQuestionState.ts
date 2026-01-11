import { useState, useMemo, useCallback } from "react";
import type { ResearchQuestion, QuestionAnswer, AskQuestionResult } from "@mythos/agent-protocol";

interface UseAskQuestionStateReturn {
  activeQuestionId: string;
  setActiveQuestionId: (id: string) => void;
  answers: Record<string, QuestionAnswer>;
  setAnswer: (questionId: string, answer: QuestionAnswer) => void;
  clearAnswer: (questionId: string) => void;
  progress: {
    total: number;
    answered: number;
    required: number;
    requiredAnswered: number;
  };
  canSubmit: boolean;
  buildResult: () => AskQuestionResult;
}

export function useAskQuestionState(
  questions: ResearchQuestion[],
  allowPartialSubmit = false
): UseAskQuestionStateReturn {
  const [activeQuestionId, setActiveQuestionId] = useState(questions[0]?.id ?? "");
  const [answers, setAnswers] = useState<Record<string, QuestionAnswer>>({});

  const setAnswer = useCallback(
    (questionId: string, answer: QuestionAnswer) => {
      setAnswers((prev) => ({ ...prev, [questionId]: answer }));

      // Auto-advance to next unanswered question (only for multi-question flows)
      if (questions.length > 1) {
        const currentIndex = questions.findIndex((q) => q.id === questionId);
        const nextUnanswered = questions
          .slice(currentIndex + 1)
          .find((q) => !answers[q.id]?.answer || answers[q.id]?.skipped);
        if (nextUnanswered) {
          setActiveQuestionId(nextUnanswered.id);
        }
      }
    },
    [questions, answers]
  );

  const clearAnswer = useCallback((questionId: string) => {
    setAnswers((prev) => {
      const { [questionId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const progress = useMemo(() => {
    const total = questions.length;
    const answered = Object.values(answers).filter((a) => a.answer && !a.skipped).length;
    const required = questions.filter((q) => q.required !== false).length;
    const requiredAnswered = questions
      .filter((q) => q.required !== false)
      .filter((q) => answers[q.id]?.answer && !answers[q.id]?.skipped).length;

    return { total, answered, required, requiredAnswered };
  }, [questions, answers]);

  const canSubmit = allowPartialSubmit
    ? progress.answered > 0
    : progress.requiredAnswered === progress.required;

  const buildResult = useCallback((): AskQuestionResult => {
    return {
      answers,
      complete: progress.requiredAnswered === progress.required,
    };
  }, [answers, progress.required, progress.requiredAnswered]);

  return {
    activeQuestionId,
    setActiveQuestionId,
    answers,
    setAnswer,
    clearAnswer,
    progress,
    canSubmit,
    buildResult,
  };
}
