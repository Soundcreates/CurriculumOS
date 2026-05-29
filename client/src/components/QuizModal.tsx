import React, { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { X, CheckCircle, XCircle } from "lucide-react";
import { submitQuiz } from "../apis/pathApi";

export type QuizQuestion = {
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
};

type QuizModalProps = {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  errorMessage: string;
  questions: QuizQuestion[];
  difficultyTiers: number;
  questionsPerTier: number;
  onDifficultyTiersChange: (value: number) => void;
  onQuestionsPerTierChange: (value: number) => void;
  onGenerateQuiz: () => void;
  roadmapId?: number;
};

type QuizState = "settings" | "taking" | "results";

const QuizModal: React.FC<QuizModalProps> = ({
  isOpen,
  onClose,
  isLoading,
  errorMessage,
  questions,
  difficultyTiers,
  questionsPerTier,
  onDifficultyTiersChange,
  onQuestionsPerTierChange,
  onGenerateQuiz,
  roadmapId,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const [quizState, setQuizState] = useState<QuizState>("settings");
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [isSavingQuiz, setIsSavingQuiz] = useState(false);
  const [generationInitiated, setGenerationInitiated] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuizState("settings");
      setUserAnswers({});
      setGenerationInitiated(false);
      return;
    }

    if (isLoading) {
      setGenerationInitiated(true);
    }

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.25 }).fromTo(
      modalRef.current,
      { opacity: 0, y: 16, scale: 0.98 },
      { opacity: 1, y: 0, scale: 1, duration: 0.32 },
      "-=0.15",
    );

    return () => {
      tl.kill();
    };
  }, [isOpen, isLoading]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isOpen]);

  const handleGenerateAndStart = () => {
    setGenerationInitiated(true);
    onGenerateQuiz();
  };

  useEffect(() => {
    if (generationInitiated && !isLoading) {
      if (questions.length > 0 && quizState === "settings") {
        setQuizState("taking");
        setUserAnswers({});
      }
      setGenerationInitiated(false);
    }
  }, [isLoading, questions, quizState, generationInitiated]);

  const handleAnswerSelect = (questionIndex: number, selectedOption: string) => {
    setUserAnswers((prev) => ({
      ...prev,
      [questionIndex]: selectedOption,
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!roadmapId || questions.length === 0) {
      setQuizState("results");
      return;
    }

    setIsSavingQuiz(true);
    try {
      const correctCount = Object.entries(userAnswers).filter(
        ([index, answer]) => questions[Number(index)]?.answer === answer,
      ).length;

      await submitQuiz({
        roadmapId,
        score: Math.round((correctCount / questions.length) * 100),
        totalQuestions: questions.length,
        correctAnswers: correctCount,
        questions,
        userAnswers,
      });

      setQuizState("results");
    } catch (err) {
      console.error("Failed to save quiz results:", err);
      setQuizState("results");
    } finally {
      setIsSavingQuiz(false);
    }
  };

  const handleRetake = () => {
    setQuizState("settings");
    setUserAnswers({});
  };

  const score = useMemo(() => {
    if (questions.length === 0) return 0;
    const correct = Object.entries(userAnswers).filter(
      ([index, answer]) => questions[Number(index)]?.answer === answer,
    ).length;
    return Math.round((correct / questions.length) * 100);
  }, [userAnswers, questions]);

  const settingsContent = (
    <div className="space-y-4">
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="font-sans text-xs uppercase tracking-[0.3em] text-[#d8bf92]">
          Quiz Settings
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="font-sans text-sm text-[#e6dece]">
            Difficulty Tiers
            <select
              value={difficultyTiers}
              onChange={(e) => onDifficultyTiersChange(Number(e.target.value))}
              className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white focus:outline-none"
            >
              {[1, 2, 3, 4].map((value) => (
                <option key={`tier-${value}`} value={value} className="bg-[#141414]">
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="font-sans text-sm text-[#e6dece]">
            Questions Per Tier
            <select
              value={questionsPerTier}
              onChange={(e) => onQuestionsPerTierChange(Number(e.target.value))}
              className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white focus:outline-none"
            >
              {[6, 10, 15].map((value) => (
                <option key={`qpt-${value}`} value={value} className="bg-[#141414]">
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 font-sans text-xs text-text-secondary">
          Total questions: {difficultyTiers * questionsPerTier}
        </p>
        <button
          onClick={handleGenerateAndStart}
          disabled={isLoading}
          className="mt-4 rounded-full bg-white px-5 py-2 font-sans text-xs uppercase tracking-[0.28em] text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Generating..." : "Generate Quiz"}
        </button>
      </section>
    </div>
  );

  const takingContent = (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <p className="font-sans text-sm text-text-secondary">
          Progress: {Object.keys(userAnswers).length} / {questions.length} answered
        </p>
        <div className="h-2 w-32 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full bg-[#f1d6a8] transition-all"
            style={{
              width: `${questions.length > 0 ? (Object.keys(userAnswers).length / questions.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {questions.map((item, index) => (
        <article key={`quiz-question-${index}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="font-sans text-xs uppercase tracking-[0.3em] text-[#d8bf92]">
            Question {index + 1}
          </p>
          <h3 className="mt-2 text-lg text-white">{item.question}</h3>

          <ul className="mt-4 space-y-2">
            {item.options.map((option, optionIndex) => {
              const optionLetter = String.fromCharCode(65 + optionIndex); // 'A', 'B', 'C', 'D'
              const isSelected = userAnswers[index] === optionLetter;
              return (
                <li key={`quiz-option-${index}-${optionIndex}`}>
                  <button
                    onClick={() => handleAnswerSelect(index, optionLetter)}
                    className={`w-full rounded-lg border px-4 py-3 text-left font-sans text-sm transition-all ${
                      isSelected
                        ? "border-[#f1d6a8] bg-[#f1d6a8]/10 text-[#f1d6a8]"
                        : "border-white/8 bg-black/20 text-[#e6dece] hover:border-white/15 hover:bg-white/5"
                    }`}
                  >
                    <span className="mr-2 font-semibold text-[#d8bf92]">{optionLetter}.</span>
                    {option}
                  </button>
                </li>
              );
            })}
          </ul>
        </article>
      ))}

      <button
        onClick={handleSubmitQuiz}
        disabled={questions.length === 0 || Object.keys(userAnswers).length !== questions.length || isSavingQuiz}
        className="w-full rounded-full bg-white px-5 py-3 font-sans text-xs uppercase tracking-[0.28em] text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSavingQuiz ? "Saving..." : "Submit Quiz"}
      </button>
    </div>
  );

  const resultsContent = (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
        <p className="font-sans text-xs uppercase tracking-[0.3em] text-[#d8bf92]">Your Score</p>
        <p className="mt-4 text-5xl font-serif text-white">{score}%</p>
        <p className="mt-2 font-sans text-sm text-text-secondary">
          {Object.entries(userAnswers).filter(([index, answer]) => questions[Number(index)]?.answer === answer)
            .length}{" "}
          out of {questions.length} correct
        </p>
      </div>

      <div className="space-y-3">
        {questions.map((item, index) => {
          const userAnswer = userAnswers[index];
          const isCorrect = userAnswer === item.answer;
          return (
            <article
              key={`result-${index}`}
              className={`rounded-xl border p-4 ${
                isCorrect
                  ? "border-[#8ecf9f]/30 bg-[#1a3328]/40"
                  : "border-[#f3989e]/30 bg-[#3b1a1a]/40"
              }`}
            >
              <div className="flex gap-3">
                {isCorrect ? (
                  <CheckCircle size={20} className="mt-1 shrink-0 text-[#8ecf9f]" />
                ) : (
                  <XCircle size={20} className="mt-1 shrink-0 text-[#f3989e]" />
                )}
                <div className="flex-1">
                  <p className="font-sans text-xs uppercase tracking-[0.3em] text-[#d8bf92]">
                    Question {index + 1} {isCorrect ? "Correct" : "Incorrect"}
                  </p>
                  <h3 className="mt-2 text-white">{item.question}</h3>

                  <div className="mt-3 space-y-2">
                    <div>
                      <p className="font-sans text-xs text-text-secondary">Your answer:</p>
                      <p className={`font-sans text-sm ${isCorrect ? "text-[#8ecf9f]" : "text-[#f3989e]"}`}>
                        {userAnswer ? `${userAnswer}) ${item.options[userAnswer.charCodeAt(0) - 65]}` : "—"}
                      </p>
                    </div>
                    {!isCorrect && (
                      <div>
                        <p className="font-sans text-xs text-text-secondary">Correct answer:</p>
                        <p className="font-sans text-sm text-[#8ecf9f]">
                          {item.answer ? `${item.answer}) ${item.options[item.answer.charCodeAt(0) - 65]}` : "—"}
                        </p>
                      </div>
                    )}
                  </div>

                  {item.explanation && (
                    <p className="mt-3 font-sans text-sm text-[#d6ccbb]">{item.explanation}</p>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <button
        onClick={handleRetake}
        className="w-full rounded-full bg-white px-5 py-3 font-sans text-xs uppercase tracking-[0.28em] text-black transition-colors hover:bg-white/90"
      >
        Generate New Quiz
      </button>
    </div>
  );

  const content = useMemo(() => {
    if (isLoading && quizState === "settings") {
      return (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 font-sans text-sm text-text-secondary">
          Generating quiz from your roadmap...
        </div>
      );
    }

    if (errorMessage) {
      return (
        <div className="rounded-xl border border-[#8c3b3b]/40 bg-[#3b1a1a]/40 p-4 font-sans text-sm text-[#f3c1c1]">
          {errorMessage}
        </div>
      );
    }

    if (quizState === "settings") {
      return settingsContent;
    }

    if (quizState === "taking") {
      return takingContent;
    }

    if (quizState === "results") {
      return resultsContent;
    }

    return null;
  }, [quizState, isLoading, errorMessage, difficultyTiers, questionsPerTier, questions, userAnswers, score]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain px-4 py-6 md:py-10">
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-[#0f0f0f]/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={modalRef}
        className="relative z-10 mx-auto my-4 w-full max-w-4xl max-h-[88vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#141414] p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="font-sans text-xs uppercase tracking-[0.35em] text-[#d8bf92]">
              {quizState === "results" ? "Quiz Results" : "Quiz Generator"}
            </p>
            <h2 className="mt-2 text-3xl text-white">
              {quizState === "results" ? "Review Your Answers" : "Roadmap Quiz"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-secondary transition-colors hover:text-white"
          >
            <X size={22} />
          </button>
        </div>

        {content}
      </div>
    </div>
  );
};

export default QuizModal;
