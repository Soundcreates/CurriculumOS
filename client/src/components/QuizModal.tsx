import React, { useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { X } from "lucide-react";

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
};

const QuizModal: React.FC<QuizModalProps> = ({
  isOpen,
  onClose,
  isLoading,
  errorMessage,
  questions,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
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
  }, [isOpen]);

  const content = useMemo(() => {
    if (isLoading) {
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

    if (!questions.length) {
      return (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 font-sans text-sm text-text-secondary">
          No quiz available yet.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {questions.map((item, index) => (
          <article
            key={`quiz-question-${index}`}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
          >
            <p className="font-sans text-xs uppercase tracking-[0.3em] text-[#d8bf92]">
              Question {index + 1}
            </p>
            <h3 className="mt-2 text-xl text-white">{item.question}</h3>

            <ul className="mt-3 space-y-2">
              {item.options.map((option, optionIndex) => (
                <li
                  key={`quiz-option-${index}-${optionIndex}`}
                  className="rounded-lg border border-white/8 bg-black/20 px-3 py-2 font-sans text-sm text-[#e6dece]"
                >
                  {option}
                </li>
              ))}
            </ul>

            <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 font-sans text-sm text-[#d6ccbb]">
              <span className="uppercase tracking-[0.2em] text-xs text-[#bba98d]">Answer:</span>{" "}
              {item.answer}
            </div>

            {item.explanation ? (
              <p className="mt-2 font-sans text-sm text-text-secondary">
                {item.explanation}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    );
  }, [errorMessage, isLoading, questions]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-[#0f0f0f]/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={modalRef}
        className="relative z-10 w-full max-w-4xl max-h-[88vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#141414] p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="font-sans text-xs uppercase tracking-[0.35em] text-[#d8bf92]">
              Quiz Generator
            </p>
            <h2 className="mt-2 text-3xl text-white">Roadmap Quiz</h2>
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
