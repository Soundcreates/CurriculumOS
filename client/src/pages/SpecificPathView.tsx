import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import gsap from "gsap";
import Layout from "../components/Layout";
import Navigation from "../components/Navigation";
import QuizModal, { type QuizQuestion as QuizQuestionView } from "../components/QuizModal";
import {
  generateQuiz,
  getAllPaths,
  updateDayProgress,
  type DayProgressEntry,
  type Roadmap,
} from "../apis/pathApi";

type DayPlan = {
  dayLabel: string;
  topic: string;
  tasks: string[];
};

function normalizeTaskText(task: string): string {
  return task.replace(/\s+/g, " ").trim();
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function parseDayObject(dayKey: string, value: unknown): DayPlan | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const numberFromRecord =
    typeof record.number === "number"
      ? record.number
      : typeof record.number === "string"
        ? Number(record.number)
        : NaN;
  const numberFromKey = Number(dayKey.replace(/[^\d]/g, ""));
  const dayNumber = Number.isFinite(numberFromRecord)
    ? numberFromRecord
    : numberFromKey;

  const topic =
    typeof record.topic === "string" && record.topic.trim()
      ? record.topic.trim()
      : "Learning Focus";

  const rawTasks = Array.isArray(record.tasks) ? record.tasks : [];
  const tasks = rawTasks
    .map((item) => (typeof item === "string" ? normalizeTaskText(item) : ""))
    .filter(Boolean);

  if (!Number.isFinite(dayNumber)) {
    return null;
  }

  return {
    dayLabel: `Day ${dayNumber}`,
    topic,
    tasks,
  };
}

function extractPlansFromObject(data: unknown): DayPlan[] {
  if (!data || typeof data !== "object") {
    return [];
  }

  const record = data as Record<string, unknown>;
  const dayEntries = Object.entries(record).filter(([key]) =>
    /^day\s*\d*$/i.test(key),
  );

  const plans = dayEntries
    .map(([key, value]) => parseDayObject(key, value))
    .filter((item): item is DayPlan => Boolean(item))
    .sort(
      (a, b) =>
        Number(a.dayLabel.replace(/[^\d]/g, "")) -
        Number(b.dayLabel.replace(/[^\d]/g, "")),
    );

  return plans;
}

function parseEmbeddedJson(content: string): DayPlan[] {
  const cleaned = content.replace(/\\"/g, '"');

  const jsonAnchorIndex = cleaned.search(/json\s*\n/i);
  if (jsonAnchorIndex >= 0) {
    const possibleJson = cleaned.slice(jsonAnchorIndex).replace(/^json\s*\n/i, "");
    const lastBrace = possibleJson.lastIndexOf("}");
    if (lastBrace > 0) {
      const candidate = possibleJson.slice(0, lastBrace + 1);
      const parsed = safeJsonParse<Record<string, unknown>>(candidate);
      if (parsed) {
        const plans = extractPlansFromObject(parsed);
        if (plans.length > 0) {
          return plans;
        }
      }
    }
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = cleaned.slice(firstBrace, lastBrace + 1);
    const parsed = safeJsonParse<Record<string, unknown>>(candidate);
    if (parsed) {
      return extractPlansFromObject(parsed);
    }
  }

  return [];
}

function parseMalformedDayBlocks(content: string): DayPlan[] {
  const normalized = content
    .replace(/\\"/g, '"')
    .replace(/\\n/g, " ")
    .replace(/\s+/g, " ");

  const blockRegex =
    /"(day\d*)"\s*:\s*\{[\s\S]*?"topic"\s*:\s*"([^"]+)"[\s\S]*?"tasks"\s*:\s*\[([\s\S]*?)\][\s\S]*?\}/gi;

  const plans: DayPlan[] = [];
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(normalized)) !== null) {
    const dayKey = match[1];
    const topic = normalizeTaskText(match[2] ?? "Learning Focus");
    const tasksChunk = match[3] ?? "";

    const tasks = Array.from(tasksChunk.matchAll(/"([^"]+)"/g))
      .map((m) => normalizeTaskText(m[1] ?? ""))
      .filter(Boolean);

    const dayNumber = Number(dayKey.replace(/[^\d]/g, "")) || 1;
    plans.push({
      dayLabel: `Day ${dayNumber}`,
      topic,
      tasks,
    });
  }

  return plans.sort(
    (a, b) =>
      Number(a.dayLabel.replace(/[^\d]/g, "")) -
      Number(b.dayLabel.replace(/[^\d]/g, "")),
  );
}

function parseRoadmapContent(content: string): DayPlan[] {
  if (!content || !content.trim()) {
    return [];
  }

  const plansFromJson = parseEmbeddedJson(content);
  if (plansFromJson.length > 0) {
    return plansFromJson;
  }

  const plansFromMalformedJson = parseMalformedDayBlocks(content);
  if (plansFromMalformedJson.length > 0) {
    return plansFromMalformedJson;
  }

  const dayRegex = /Day\s*(\d+)\s*:\s*([\s\S]*?)(?=\n\s*Day\s*\d+\s*:|$)/gi;
  const plans: DayPlan[] = [];
  let match: RegExpExecArray | null;

  while ((match = dayRegex.exec(content)) !== null) {
    const dayNumber = match[1];
    const block = match[2] ?? "";

    const topicMatch = block.match(/Topic\s*:\s*(.*)/i);
    const topic = topicMatch?.[1]?.trim() || "Learning Focus";

    const tasksSectionMatch = block.match(/Tasks\s*:\s*([\s\S]*)/i);
    const tasksRaw = tasksSectionMatch?.[1] ?? "";
    const tasks = tasksRaw
      .split("\n")
      .map((line) => normalizeTaskText(line.replace(/^[-*\d.)\s]+/, "")))
      .filter(Boolean);

    plans.push({
      dayLabel: `Day ${dayNumber}`,
      topic,
      tasks,
    });
  }

  return plans;
}

function parseDayProgress(raw?: string): Record<string, boolean> {
  if (!raw || !raw.trim()) {
    return {};
  }

  const parsed = safeJsonParse<DayProgressEntry[]>(raw);
  if (!parsed || !Array.isArray(parsed)) {
    return {};
  }

  return parsed.reduce<Record<string, boolean>>((acc, entry) => {
    if (entry.dayLabel) {
      acc[entry.dayLabel] = Boolean(entry.completed);
    }
    return acc;
  }, {});
}

function parseQuizFromResponse(raw: string): QuizQuestionView[] {
  const cleaned = raw.replace(/\\n/g, "\n").replace(/\\"/g, '"');
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace < 0 || lastBrace <= firstBrace) {
    return [];
  }

  const candidate = cleaned.slice(firstBrace, lastBrace + 1);
  const parsed = safeJsonParse<{ questions?: QuizQuestionView[] }>(candidate);

  if (!parsed?.questions || !Array.isArray(parsed.questions)) {
    return [];
  }

  return parsed.questions.filter(
    (q) =>
      typeof q.question === "string" &&
      Array.isArray(q.options) &&
      typeof q.answer === "string",
  );
}

const SpecificPathView: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [path, setPath] = useState<Roadmap | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [completionMap, setCompletionMap] = useState<Record<string, boolean>>({});
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizError, setQuizError] = useState("");
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestionView[]>([]);
  const heroRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchPath = async () => {
      setIsLoading(true);
      setErrorMessage("");

      const allPaths = await getAllPaths();
      const parsedId = Number(id);
      const selectedPath = allPaths.find((item) => item.id === parsedId) ?? null;

      if (!selectedPath) {
        setErrorMessage("Path not found. It may have been removed.");
      }

      setPath(selectedPath);
      setCompletionMap(parseDayProgress(selectedPath?.dayProgress));
      setIsLoading(false);
    };

    fetchPath();
  }, [id]);

  useEffect(() => {
    const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });

    timeline
      .fromTo(
        heroRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.85 },
      )
      .fromTo(
        timelineRef.current?.children || [],
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.7, stagger: 0.08 },
        "-=0.45",
      );

    return () => {
      timeline.kill();
    };
  }, []);

  const dayPlans = useMemo(() => {
    if (!path?.roadmapContent) {
      return [];
    }
    return parseRoadmapContent(path.roadmapContent);
  }, [path]);

  const allDaysCompleted = useMemo(() => {
    if (!dayPlans.length) {
      return false;
    }
    return dayPlans.every((day) => completionMap[day.dayLabel]);
  }, [completionMap, dayPlans]);

  const handleToggleDayCompletion = async (dayLabel: string) => {
    if (!path) {
      return;
    }

    const current = Boolean(completionMap[dayLabel]);
    const next = !current;

    setCompletionMap((prev) => ({
      ...prev,
      [dayLabel]: next,
    }));

    try {
      const response = await updateDayProgress(path.id, dayLabel, next);
      const updatedMap = response.data.dayProgress.reduce<Record<string, boolean>>(
        (acc, item) => {
          acc[item.dayLabel] = Boolean(item.completed);
          return acc;
        },
        {},
      );
      setCompletionMap(updatedMap);
    } catch {
      setCompletionMap((prev) => ({
        ...prev,
        [dayLabel]: current,
      }));
    }
  };

  const handleGenerateQuiz = async () => {
    if (!path || !allDaysCompleted) {
      return;
    }

    setIsQuizModalOpen(true);
    setIsGeneratingQuiz(true);
    setQuizError("");
    setQuizQuestions([]);

    try {
      const response = await generateQuiz(path.id);
      const parsedQuestions = parseQuizFromResponse(response.data.quiz);
      if (!parsedQuestions.length) {
        setQuizError("Quiz generated, but it could not be parsed into question format.");
      } else {
        setQuizQuestions(parsedQuestions);
      }
    } catch {
      setQuizError("Failed to generate quiz. Please try again.");
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  return (
    <Layout>
      <Navigation />
      <QuizModal
        isOpen={isQuizModalOpen}
        onClose={() => setIsQuizModalOpen(false)}
        isLoading={isGeneratingQuiz}
        errorMessage={quizError}
        questions={quizQuestions}
      />
      <div className="min-h-screen px-6 pb-20 pt-28 md:px-10">
        <div className="mx-auto max-w-6xl">
          <section
            ref={heroRef}
            className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(241,214,168,0.16),_transparent_35%),linear-gradient(140deg,_rgba(255,255,255,0.06),_rgba(255,255,255,0.02))] p-8 md:p-10"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="mb-3 font-sans text-xs uppercase tracking-[0.38em] text-[#d8bf92]">
                  Specific Path View
                </p>
                <h1 className="text-4xl text-white md:text-5xl">
                  {path?.name ?? "Path Detail"}
                </h1>
                <p className="mt-4 max-w-3xl font-sans text-base leading-7 text-[#d6ccbb]">
                  {path?.description ||
                    "A structured roadmap broken into clear daily milestones, focused topics, and actionable tasks."}
                </p>
              </div>

              <button
                onClick={() => navigate("/dashboard")}
                className="rounded-full border border-white/15 px-5 py-2 font-sans text-xs uppercase tracking-[0.3em] text-white transition-colors hover:bg-white/10"
              >
                Back to Dashboard
              </button>
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="font-sans text-xs uppercase tracking-[0.3em] text-[#bba98d]">Time Query</p>
                <p className="mt-2 text-lg text-white">{path?.timeQuery ?? "-"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="font-sans text-xs uppercase tracking-[0.3em] text-[#bba98d]">Documents</p>
                <p className="mt-2 text-lg text-white">{path?.documentsCount ?? 0}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="font-sans text-xs uppercase tracking-[0.3em] text-[#bba98d]">Processed Types</p>
                <p className="mt-2 text-lg text-white">{path?.processedTypes || "-"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="font-sans text-xs uppercase tracking-[0.3em] text-[#bba98d]">Generated Days</p>
                <p className="mt-2 text-lg text-white">{dayPlans.length || "-"}</p>
              </div>
            </div>
          </section>

          {isLoading ? (
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-5 font-sans text-text-secondary">
              Loading path roadmap...
            </div>
          ) : null}

          {!isLoading && errorMessage ? (
            <div className="mt-8 rounded-2xl border border-[#8c3b3b]/40 bg-[#3b1a1a]/40 px-6 py-5 font-sans text-[#f3c1c1]">
              {errorMessage}
            </div>
          ) : null}

          {!isLoading && path && (
            <section ref={timelineRef} className="mt-8 space-y-4">
              {dayPlans.length > 0 ? (
                dayPlans.map((plan, index) => {
                  const completed = Boolean(completionMap[plan.dayLabel]);

                  return (
                    <article
                      key={`${plan.dayLabel}-${index}`}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-sans text-xs uppercase tracking-[0.32em] text-[#d8bf92]">
                            {plan.dayLabel}
                          </p>
                          <h2 className="mt-2 text-3xl text-white">{plan.topic}</h2>
                        </div>
                        <button
                          onClick={() => handleToggleDayCompletion(plan.dayLabel)}
                          className={`rounded-full px-4 py-2 font-sans text-[11px] uppercase tracking-[0.28em] transition-colors ${
                            completed
                              ? "border border-[#8ecf9f]/40 bg-[#1f3a2b] text-[#d2f0da]"
                              : "border border-white/10 bg-black/25 text-text-secondary hover:bg-white/10"
                          }`}
                        >
                          {completed ? "Completed" : "Mark Complete"}
                        </button>
                      </div>

                      <div className="mt-6">
                        <p className="font-sans text-xs uppercase tracking-[0.32em] text-[#bba98d]">Tasks</p>
                        {plan.tasks.length > 0 ? (
                          <ul className="mt-3 space-y-3">
                            {plan.tasks.map((task, taskIndex) => (
                              <li
                                key={`${plan.dayLabel}-task-${taskIndex}`}
                                className="rounded-xl border border-white/8 bg-black/15 px-4 py-3 font-sans text-sm leading-6 text-[#e6dece]"
                              >
                                {task}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-3 font-sans text-sm text-text-secondary">
                            No explicit tasks found in this day block.
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })
              ) : (
                <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <p className="font-sans text-xs uppercase tracking-[0.32em] text-[#bba98d]">Raw Roadmap Content</p>
                  <pre className="mt-4 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-[#ddd2c0]">
                    {path.roadmapContent}
                  </pre>
                </article>
              )}

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                  <div>
                    <p className="font-sans text-xs uppercase tracking-[0.32em] text-[#bba98d]">Assessment</p>
                    <h3 className="mt-2 text-2xl text-white">Generate Final Quiz</h3>
                    <p className="mt-2 max-w-2xl font-sans text-sm text-text-secondary">
                      Complete all day phases to unlock quiz generation from this roadmap.
                    </p>
                  </div>

                  <button
                    onClick={handleGenerateQuiz}
                    disabled={!allDaysCompleted}
                    className="rounded-full bg-white px-5 py-2 font-sans text-xs uppercase tracking-[0.28em] text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Generate Quiz
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default SpecificPathView;
