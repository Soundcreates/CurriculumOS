import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import gsap from "gsap";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Loader2,
  Play,
  Sparkles,
} from "lucide-react";
import Layout from "../components/Layout";
import Navigation from "../components/Navigation";
import QuizModal, { type QuizQuestion as QuizQuestionView } from "../components/QuizModal";
import {
  fetchDayResources,
  generateQuiz,
  getAllPaths,
  updateDayProgress,
  updateTaskProgress,
  type DayProgressEntry,
  type ResourceItem,
  type Roadmap,
  type TaskProgressEntry,
} from "../apis/pathApi";

// ─── Types ───────────────────────────────────────────────────────────────────

type DayPlan = {
  dayLabel: string;
  topic: string;
  tasks: string[];
};

type TaskMap = Record<string, Record<number, boolean>>;

// ─── Parsing helpers (preserved from original) ────────────────────────────────

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
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const numberFromRecord =
    typeof record.number === "number"
      ? record.number
      : typeof record.number === "string"
        ? Number(record.number)
        : NaN;
  const numberFromKey = Number(dayKey.replace(/[^\d]/g, ""));
  const dayNumber = Number.isFinite(numberFromRecord) ? numberFromRecord : numberFromKey;
  const topic =
    typeof record.topic === "string" && record.topic.trim()
      ? record.topic.trim()
      : "Learning Focus";
  const rawTasks = Array.isArray(record.tasks) ? record.tasks : [];
  const tasks = rawTasks
    .map((item) => (typeof item === "string" ? normalizeTaskText(item) : ""))
    .filter(Boolean);
  if (!Number.isFinite(dayNumber)) return null;
  return { dayLabel: `Day ${dayNumber}`, topic, tasks };
}

function extractPlansFromObject(data: unknown): DayPlan[] {
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  const daysArray = Array.isArray(record.days) ? record.days : [];
  if (daysArray.length > 0) {
    const fromArray = daysArray
      .map((value, index) => parseDayObject(`day${index + 1}`, value))
      .filter((item): item is DayPlan => Boolean(item))
      .sort((a, b) => Number(a.dayLabel.replace(/[^\d]/g, "")) - Number(b.dayLabel.replace(/[^\d]/g, "")));
    if (fromArray.length > 0) return fromArray;
  }
  const dayEntries = Object.entries(record).filter(([key]) => /^day\s*\d*$/i.test(key));
  return dayEntries
    .map(([key, value]) => parseDayObject(key, value))
    .filter((item): item is DayPlan => Boolean(item))
    .sort((a, b) => Number(a.dayLabel.replace(/[^\d]/g, "")) - Number(b.dayLabel.replace(/[^\d]/g, "")));
}

function parseEmbeddedJson(content: string): DayPlan[] {
  const cleaned = content.replace(/\\"/g, '"');
  const jsonAnchorIndex = cleaned.search(/json\s*\n/i);
  if (jsonAnchorIndex >= 0) {
    const possibleJson = cleaned.slice(jsonAnchorIndex).replace(/^json\s*\n/i, "");
    const lastBrace = possibleJson.lastIndexOf("}");
    if (lastBrace > 0) {
      const parsed = safeJsonParse<Record<string, unknown>>(possibleJson.slice(0, lastBrace + 1));
      if (parsed) {
        const plans = extractPlansFromObject(parsed);
        if (plans.length > 0) return plans;
      }
    }
  }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const parsed = safeJsonParse<Record<string, unknown>>(cleaned.slice(firstBrace, lastBrace + 1));
    if (parsed) return extractPlansFromObject(parsed);
  }
  return [];
}

function parseMalformedDayBlocks(content: string): DayPlan[] {
  const normalized = content.replace(/\\"/g, '"').replace(/\\n/g, " ").replace(/\s+/g, " ");
  const blockRegex =
    /"(day\d*)"\s*:\s*\{[\s\S]*?"topic"\s*:\s*"([^"]+)"[\s\S]*?"tasks"\s*:\s*\[([\s\S]*?)\][\s\S]*?\}/gi;
  const plans: DayPlan[] = [];
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(normalized)) !== null) {
    const dayKey = match[1];
    const topic = normalizeTaskText(match[2] ?? "Learning Focus");
    const tasks = Array.from((match[3] ?? "").matchAll(/"([^"]+)"/g))
      .map((m) => normalizeTaskText(m[1] ?? ""))
      .filter(Boolean);
    const dayNumber = Number(dayKey.replace(/[^\d]/g, "")) || 1;
    plans.push({ dayLabel: `Day ${dayNumber}`, topic, tasks });
  }
  return plans.sort((a, b) => Number(a.dayLabel.replace(/[^\d]/g, "")) - Number(b.dayLabel.replace(/[^\d]/g, "")));
}

function parseRoadmapContent(content: string): DayPlan[] {
  if (!content?.trim()) return [];
  const fromJson = parseEmbeddedJson(content);
  if (fromJson.length > 0) return fromJson;
  const fromMalformed = parseMalformedDayBlocks(content);
  if (fromMalformed.length > 0) return fromMalformed;
  const dayRegex =
    /(?:^|\n)\s*(?:[#*\- ]*)Day\s*(\d+)\s*[:\-]?\s*([\s\S]*?)(?=\n\s*(?:[#*\- ]*)Day\s*\d+\s*[:\-]?|$)/gi;
  const plans: DayPlan[] = [];
  let match: RegExpExecArray | null;
  while ((match = dayRegex.exec(content)) !== null) {
    const block = match[2] ?? "";
    const topicMatch = block.match(/(?:\*\*)?\s*Topic(?:\*\*)?\s*:\s*(.*)/i);
    const fallbackLine = block
      .split("\n")
      .map((l) => normalizeTaskText(l.replace(/[*#>-]/g, "")))
      .find((l) => l && !/^tasks?\s*:?$/i.test(l) && !/^[-*]\s*/.test(l) && !/^\d+[.)]\s+/.test(l));
    const topic = topicMatch?.[1]?.trim() || fallbackLine || "Learning Focus";
    const tasksSectionMatch = block.match(/(?:\*\*)?\s*Tasks?(?:\*\*)?\s*:\s*([\s\S]*)/i);
    const tasks = (tasksSectionMatch?.[1] ?? block)
      .split("\n")
      .map((l) => normalizeTaskText(l.replace(/^\s*(?:[-*]|\d+[.)])\s+/, "").replace(/^\s*(?:tasks?|topic)\s*:\s*/i, "").replace(/\*\*/g, "")))
      .filter((l) => Boolean(l) && !/^learning focus$/i.test(l) && !/^tasks?$/i.test(l) && !/^topic$/i.test(l));
    plans.push({ dayLabel: `Day ${match[1]}`, topic, tasks });
  }
  return plans;
}

function parseDayProgress(raw?: string): Record<string, boolean> {
  if (!raw?.trim()) return {};
  const parsed = safeJsonParse<DayProgressEntry[]>(raw);
  if (!parsed || !Array.isArray(parsed)) return {};
  return parsed.reduce<Record<string, boolean>>((acc, e) => {
    if (e.dayLabel) acc[e.dayLabel] = Boolean(e.completed);
    return acc;
  }, {});
}

function parseTaskProgressJson(raw?: string): TaskMap {
  if (!raw?.trim()) return {};
  const parsed = safeJsonParse<TaskProgressEntry[]>(raw);
  if (!parsed || !Array.isArray(parsed)) return {};
  return parsed.reduce<TaskMap>((acc, e) => {
    if (!acc[e.dayLabel]) acc[e.dayLabel] = {};
    acc[e.dayLabel][e.taskIndex] = Boolean(e.completed);
    return acc;
  }, {});
}

function parseQuizFromResponse(raw: string): QuizQuestionView[] {
  const cleaned = raw.replace(/\\n/g, "\n").replace(/\\"/g, '"');
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) return [];
  const parsed = safeJsonParse<{ questions?: QuizQuestionView[] }>(cleaned.slice(firstBrace, lastBrace + 1));
  if (!parsed?.questions || !Array.isArray(parsed.questions)) return [];
  return parsed.questions.filter(
    (q) => typeof q.question === "string" && Array.isArray(q.options) && typeof q.answer === "string",
  );
}

function isPlaceholderTopic(topic: string): boolean {
  const lower = topic.toLowerCase().trim();
  return lower.includes("unknown") || lower === "learning focus" || lower === "";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const ProgressRing: React.FC<{ percent: number; completedDays: number; totalDays: number }> = ({
  percent,
  completedDays,
  totalDays,
}) => {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="136" height="136" viewBox="0 0 136 136">
        <circle cx="68" cy="68" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
        <circle
          cx="68" cy="68" r={r} fill="none"
          stroke={percent === 100 ? "#8ecf9f" : "#f1d6a8"}
          strokeWidth="12"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 68 68)"
          style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.4s ease" }}
        />
        <text x="68" y="62" textAnchor="middle" fill="white" fontSize="24" fontFamily="serif" fontWeight="400">
          {percent}%
        </text>
        <text x="68" y="80" textAnchor="middle" fill="#978d7d" fontSize="11" fontFamily="sans-serif">
          complete
        </text>
      </svg>
      <p className="font-sans text-sm text-text-secondary">
        {completedDays} / {totalDays} days
      </p>
    </div>
  );
};

const TaskCheckbox: React.FC<{
  task: string;
  completed: boolean;
  onChange: (val: boolean) => void;
}> = ({ task, completed, onChange }) => (
  <button
    onClick={() => onChange(!completed)}
    className={`group flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
      completed
        ? "border-[#8ecf9f]/30 bg-[#1a3328]/60"
        : "border-white/8 bg-black/15 hover:border-white/20 hover:bg-white/5"
    }`}
  >
    <div
      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all ${
        completed ? "border-[#8ecf9f] bg-[#8ecf9f]" : "border-white/30 group-hover:border-white/60"
      }`}
    >
      {completed && <Check size={9} className="text-black" strokeWidth={3} />}
    </div>
    <span
      className={`font-sans text-sm leading-6 transition-colors ${
        completed ? "text-[#9ab8a4] line-through" : "text-[#e6dece]"
      }`}
    >
      {task}
    </span>
  </button>
);

const ResourceLink: React.FC<{ resource: ResourceItem }> = ({ resource }) => (
  <a
    href={resource.url}
    target="_blank"
    rel="noopener noreferrer"
    className="group flex items-start gap-3 rounded-xl border border-white/8 bg-black/20 px-4 py-3 transition-all hover:border-white/20 hover:bg-white/5"
  >
    <div
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
        resource.type === "video" ? "bg-[#f1d6a8]/15" : "bg-white/8"
      }`}
    >
      {resource.type === "video" ? (
        <Play size={10} className="text-[#f1d6a8]" fill="currentColor" />
      ) : (
        <FileText size={10} className="text-white/50" />
      )}
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate font-sans text-sm text-white">{resource.title}</p>
      {resource.description && (
        <p className="mt-0.5 line-clamp-2 font-sans text-xs text-text-secondary">{resource.description}</p>
      )}
    </div>
    <ExternalLink size={13} className="mt-0.5 shrink-0 text-text-secondary opacity-0 transition-opacity group-hover:opacity-100" />
  </a>
);

// ─── Main component ───────────────────────────────────────────────────────────

const SpecificPathView: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const heroRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [path, setPath] = useState<Roadmap | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [completionMap, setCompletionMap] = useState<Record<string, boolean>>({});
  const [taskMap, setTaskMap] = useState<TaskMap>({});

  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [resourcesMap, setResourcesMap] = useState<Record<string, ResourceItem[]>>({});
  const [loadingResources, setLoadingResources] = useState<Record<string, boolean>>({});

  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizError, setQuizError] = useState("");
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestionView[]>([]);
  const [difficultyTiers, setDifficultyTiers] = useState(2);
  const [questionsPerTier, setQuestionsPerTier] = useState(6);

  useEffect(() => {
    const fetchPath = async () => {
      setIsLoading(true);
      const allPaths = await getAllPaths();
      const selected = allPaths.find((p) => p.id === Number(id)) ?? null;
      setPath(selected);
      setCompletionMap(parseDayProgress(selected?.dayProgress));
      setTaskMap(parseTaskProgressJson(selected?.taskProgress));
      setIsLoading(false);
      if (!selected) setErrorMessage("Path not found. It may have been removed.");
    };
    fetchPath();
  }, [id]);

  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.fromTo(heroRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8 })
      .fromTo(contentRef.current, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7 }, "-=0.4");
    return () => { tl.kill(); };
  }, []);

  const dayPlans = useMemo(() => {
    if (!path?.roadmapContent) return [];
    return parseRoadmapContent(path.roadmapContent);
  }, [path]);

  // Expand all days by default once plans are parsed
  useEffect(() => {
    if (dayPlans.length === 0) return;
    setExpandedDays(dayPlans.reduce<Record<string, boolean>>((acc, d) => { acc[d.dayLabel] = true; return acc; }, {}));
  }, [dayPlans]);

  const completedDays = useMemo(() => dayPlans.filter((d) => completionMap[d.dayLabel]).length, [dayPlans, completionMap]);
  const totalDays = dayPlans.length;
  const progressPercent = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

  const totalTasks = useMemo(() => dayPlans.reduce((s, d) => s + d.tasks.length, 0), [dayPlans]);
  const completedTaskCount = useMemo(
    () => Object.values(taskMap).reduce((s, tasks) => s + Object.values(tasks).filter(Boolean).length, 0),
    [taskMap],
  );

  const allDaysCompleted = totalDays > 0 && completedDays === totalDays;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleToggleDayCompletion = async (dayLabel: string) => {
    if (!path) return;
    const current = Boolean(completionMap[dayLabel]);
    const next = !current;
    setCompletionMap((prev) => ({ ...prev, [dayLabel]: next }));

    // When marking day complete, also mark all its tasks complete
    if (next) {
      const day = dayPlans.find((d) => d.dayLabel === dayLabel);
      if (day && day.tasks.length > 0) {
        const allDone: Record<number, boolean> = {};
        day.tasks.forEach((_, i) => { allDone[i] = true; });
        setTaskMap((prev) => ({ ...prev, [dayLabel]: allDone }));
        day.tasks.forEach((_, i) => {
          if (path) updateTaskProgress(path.id, dayLabel, i, true).catch(() => {});
        });
      }
    }

    try {
      const res = await updateDayProgress(path.id, dayLabel, next);
      setCompletionMap(
        res.data.dayProgress.reduce<Record<string, boolean>>((acc, item) => {
          acc[item.dayLabel] = Boolean(item.completed);
          return acc;
        }, {}),
      );
    } catch {
      setCompletionMap((prev) => ({ ...prev, [dayLabel]: current }));
    }
  };

  const handleToggleTask = async (dayLabel: string, taskIndex: number, completed: boolean) => {
    setTaskMap((prev) => ({
      ...prev,
      [dayLabel]: { ...(prev[dayLabel] || {}), [taskIndex]: completed },
    }));

    if (path) {
      updateTaskProgress(path.id, dayLabel, taskIndex, completed).catch(() => {});
    }

    // Auto-unmark day if unchecking a task while day is complete
    if (!completed && completionMap[dayLabel]) {
      setCompletionMap((prev) => ({ ...prev, [dayLabel]: false }));
      if (path) updateDayProgress(path.id, dayLabel, false).catch(() => {});
    }

    // Auto-mark day complete when all tasks are done
    if (completed) {
      const day = dayPlans.find((d) => d.dayLabel === dayLabel);
      if (day && day.tasks.length > 0) {
        const updated = { ...(taskMap[dayLabel] || {}), [taskIndex]: true };
        const allDone = day.tasks.every((_, i) => updated[i]);
        if (allDone && !completionMap[dayLabel]) {
          setCompletionMap((prev) => ({ ...prev, [dayLabel]: true }));
          if (path) updateDayProgress(path.id, dayLabel, true).catch(() => {});
        }
      }
    }
  };

  const handleLoadResources = async (dayLabel: string, topic: string) => {
    if (resourcesMap[dayLabel] !== undefined || loadingResources[dayLabel] || !path) return;
    setLoadingResources((prev) => ({ ...prev, [dayLabel]: true }));
    try {
      const result = await fetchDayResources([topic], path.userGoal);
      setResourcesMap((prev) => ({ ...prev, [dayLabel]: result[topic] ?? [] }));
    } finally {
      setLoadingResources((prev) => ({ ...prev, [dayLabel]: false }));
    }
  };

  const handleGenerateQuiz = async () => {
    if (!path || !allDaysCompleted) return;
    setIsGeneratingQuiz(true);
    setQuizError("");
    setQuizQuestions([]);
    try {
      const res = await generateQuiz(path.id, difficultyTiers, questionsPerTier);
      const parsed = parseQuizFromResponse(res.data.quiz);
      if (!parsed.length) setQuizError("Quiz generated but could not be parsed.");
      else setQuizQuestions(parsed);
    } catch {
      setQuizError("Failed to generate quiz. Please try again.");
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <Navigation />
      <QuizModal
        isOpen={isQuizModalOpen}
        onClose={() => setIsQuizModalOpen(false)}
        isLoading={isGeneratingQuiz}
        errorMessage={quizError}
        questions={quizQuestions}
        difficultyTiers={difficultyTiers}
        questionsPerTier={questionsPerTier}
        onDifficultyTiersChange={setDifficultyTiers}
        onQuestionsPerTierChange={setQuestionsPerTier}
        onGenerateQuiz={handleGenerateQuiz}
        roadmapId={path?.id}
      />

      <div className="min-h-screen px-6 pb-24 pt-28 md:px-10">
        <div className="mx-auto max-w-7xl">

          {/* ── Hero header ── */}
          <section
            ref={heroRef}
            className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(241,214,168,0.14),_transparent_38%),linear-gradient(140deg,_rgba(255,255,255,0.05),_rgba(255,255,255,0.02))] p-8 md:p-10"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="mb-3 font-sans text-xs uppercase tracking-[0.38em] text-[#d8bf92]">
                  Learning Path
                </p>
                <h1 className="text-4xl text-white md:text-5xl">{path?.name ?? "Path Detail"}</h1>
                <p className="mt-4 max-w-3xl font-sans text-base leading-7 text-[#d6ccbb]">
                  {path?.description || "A structured roadmap broken into clear daily milestones, focused topics, and actionable tasks."}
                </p>
              </div>
              <button
                onClick={() => navigate("/dashboard")}
                className="flex items-center gap-2 rounded-full border border-white/15 px-5 py-2 font-sans text-xs uppercase tracking-[0.3em] text-white transition-colors hover:bg-white/10"
              >
                <ArrowLeft size={14} />
                Dashboard
              </button>
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-4">
              {[
                { label: "Time Query", value: path?.timeQuery ?? "-" },
                { label: "Documents", value: String(path?.documentsCount ?? 0) },
                { label: "Source", value: path?.processedTypes || "-" },
                { label: "Days", value: String(totalDays || "-") },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="font-sans text-xs uppercase tracking-[0.3em] text-[#bba98d]">{item.label}</p>
                  <p className="mt-2 text-lg text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          {isLoading && (
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-5 font-sans text-text-secondary">
              Loading roadmap...
            </div>
          )}

          {!isLoading && errorMessage && (
            <div className="mt-8 rounded-2xl border border-[#8c3b3b]/40 bg-[#3b1a1a]/40 px-6 py-5 font-sans text-[#f3c1c1]">
              {errorMessage}
            </div>
          )}

          {!isLoading && path && (
            <div ref={contentRef} className="mt-8 grid gap-8 xl:grid-cols-[1fr_320px] xl:items-start">

              {/* ── Left: Day cards ── */}
              <div className="space-y-4">
                {dayPlans.length > 0 ? (
                  dayPlans.map((plan) => {
                    const dayCompleted = Boolean(completionMap[plan.dayLabel]);
                    const dayTasks = taskMap[plan.dayLabel] ?? {};
                    const completedTasksInDay = plan.tasks.filter((_, i) => dayTasks[i]).length;
                    const isExpanded = expandedDays[plan.dayLabel] ?? true;
                    const dayResources = resourcesMap[plan.dayLabel];
                    const isLoadingRes = loadingResources[plan.dayLabel];
                    const placeholder = isPlaceholderTopic(plan.topic);

                    return (
                      <article
                        key={plan.dayLabel}
                        className={`overflow-hidden rounded-2xl border transition-colors ${
                          dayCompleted
                            ? "border-[#8ecf9f]/25 bg-[#111f1a]/80"
                            : "border-white/10 bg-white/[0.03]"
                        }`}
                      >
                        {/* Day header */}
                        <div
                          className="flex cursor-pointer flex-wrap items-start justify-between gap-3 p-6"
                          onClick={() =>
                            setExpandedDays((prev) => ({ ...prev, [plan.dayLabel]: !isExpanded }))
                          }
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <p className="font-sans text-xs uppercase tracking-[0.32em] text-[#d8bf92]">
                                {plan.dayLabel}
                              </p>
                              {placeholder && (
                                <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 font-sans text-[10px] uppercase tracking-wider text-yellow-400">
                                  Inferred topic
                                </span>
                              )}
                              {dayCompleted && (
                                <span className="flex items-center gap-1 rounded-full border border-[#8ecf9f]/30 bg-[#1a3328]/60 px-2 py-0.5 font-sans text-[10px] uppercase tracking-wider text-[#8ecf9f]">
                                  <Check size={10} strokeWidth={3} /> Done
                                </span>
                              )}
                            </div>
                            <h2 className="mt-2 text-2xl text-white">{plan.topic}</h2>
                            <p className="mt-1 font-sans text-xs text-text-secondary">
                              {completedTasksInDay} / {plan.tasks.length} tasks complete
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleDayCompletion(plan.dayLabel);
                              }}
                              className={`rounded-full px-4 py-2 font-sans text-[11px] uppercase tracking-[0.28em] transition-all ${
                                dayCompleted
                                  ? "border border-[#8ecf9f]/40 bg-[#1f3a2b] text-[#d2f0da] hover:bg-[#2a4d39]"
                                  : "border border-white/10 bg-black/25 text-text-secondary hover:bg-white/10 hover:text-white"
                              }`}
                            >
                              {dayCompleted ? "Completed" : "Mark Complete"}
                            </button>
                            {isExpanded ? (
                              <ChevronUp size={18} className="text-text-secondary" />
                            ) : (
                              <ChevronDown size={18} className="text-text-secondary" />
                            )}
                          </div>
                        </div>

                        {/* Expandable body */}
                        {isExpanded && (
                          <div className="border-t border-white/5 px-6 pb-6 pt-5">
                            {/* Tasks */}
                            {plan.tasks.length > 0 ? (
                              <div>
                                <p className="mb-3 font-sans text-xs uppercase tracking-[0.32em] text-[#bba98d]">
                                  Tasks
                                </p>
                                <div className="space-y-2">
                                  {plan.tasks.map((task, taskIndex) => (
                                    <TaskCheckbox
                                      key={`${plan.dayLabel}-task-${taskIndex}`}
                                      task={task}
                                      completed={Boolean(dayTasks[taskIndex])}
                                      onChange={(val) => handleToggleTask(plan.dayLabel, taskIndex, val)}
                                    />
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <p className="font-sans text-sm text-text-secondary">No tasks defined for this day.</p>
                            )}

                            {/* Resources section */}
                            <div className="mt-6">
                              <div className="flex items-center justify-between">
                                <p className="font-sans text-xs uppercase tracking-[0.32em] text-[#bba98d]">
                                  Resources
                                </p>
                                {dayResources === undefined && (
                                  <button
                                    onClick={() => handleLoadResources(plan.dayLabel, plan.topic)}
                                    disabled={isLoadingRes}
                                    className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 font-sans text-[11px] uppercase tracking-wider text-text-secondary transition-all hover:border-white/25 hover:text-white disabled:opacity-50"
                                  >
                                    {isLoadingRes ? (
                                      <>
                                        <Loader2 size={12} className="animate-spin" />
                                        Searching...
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles size={12} />
                                        Load Resources
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>

                              {dayResources !== undefined && (
                                <div className="mt-3 space-y-2">
                                  {dayResources.length === 0 ? (
                                    <p className="font-sans text-sm text-text-secondary">
                                      No resources found for this topic.
                                    </p>
                                  ) : (
                                    dayResources.map((res, i) => (
                                      <ResourceLink key={i} resource={res} />
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })
                ) : (
                  <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                    <p className="font-sans text-xs uppercase tracking-[0.32em] text-[#bba98d]">Raw Content</p>
                    <pre className="mt-4 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-[#ddd2c0]">
                      {path.roadmapContent}
                    </pre>
                  </article>
                )}

                {/* Quiz section */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-sans text-xs uppercase tracking-[0.32em] text-[#bba98d]">Assessment</p>
                      <h3 className="mt-2 text-2xl text-white">Generate Final Quiz</h3>
                      <p className="mt-2 max-w-xl font-sans text-sm text-text-secondary">
                        {allDaysCompleted
                          ? "All days complete — quiz generation unlocked."
                          : `Complete all ${totalDays} days to unlock quiz generation.`}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setIsQuizModalOpen(true);
                        setQuizError("");
                        setQuizQuestions([]);
                        handleGenerateQuiz();
                      }}
                      disabled={!allDaysCompleted || isGeneratingQuiz}
                      className="rounded-full bg-white px-5 py-2 font-sans text-xs uppercase tracking-[0.28em] text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isGeneratingQuiz ? "Generating Quiz..." : "Generate Quiz"}
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Right: Sticky sidebar ── */}
              <aside className="space-y-4 xl:sticky xl:top-28">
                {/* Progress card */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <p className="mb-5 font-sans text-xs uppercase tracking-[0.35em] text-[#bba98d]">Progress</p>
                  <div className="flex justify-center">
                    <ProgressRing
                      percent={progressPercent}
                      completedDays={completedDays}
                      totalDays={totalDays}
                    />
                  </div>

                  <div className="mt-6 space-y-3">
                    {[
                      { label: "Days Completed", value: `${completedDays} / ${totalDays}` },
                      { label: "Tasks Done", value: `${completedTaskCount} / ${totalTasks}` },
                      { label: "Source", value: path.processedTypes || "—" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between border-b border-white/5 pb-3 font-sans text-sm">
                        <span className="text-text-secondary">{item.label}</span>
                        <span className="text-white">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Day overview card */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <p className="mb-4 font-sans text-xs uppercase tracking-[0.35em] text-[#bba98d]">Day Overview</p>
                  <div className="space-y-2">
                    {dayPlans.map((plan) => {
                      const done = Boolean(completionMap[plan.dayLabel]);
                      const dayTasks = taskMap[plan.dayLabel] ?? {};
                      const doneCount = plan.tasks.filter((_, i) => dayTasks[i]).length;
                      const pct = plan.tasks.length > 0 ? Math.round((doneCount / plan.tasks.length) * 100) : 0;
                      return (
                        <div
                          key={plan.dayLabel}
                          className="flex items-center gap-3 cursor-pointer"
                          onClick={() =>
                            setExpandedDays((prev) => ({ ...prev, [plan.dayLabel]: true }))
                          }
                        >
                          <div
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                              done ? "border-[#8ecf9f] bg-[#8ecf9f]" : "border-white/20"
                            }`}
                          >
                            {done && <Check size={10} className="text-black" strokeWidth={3} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <p className="truncate font-sans text-xs text-white">{plan.dayLabel}</p>
                              <p className="ml-2 shrink-0 font-sans text-xs text-text-secondary">{pct}%</p>
                            </div>
                            <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/8">
                              <div
                                className={`h-full rounded-full transition-all ${done ? "bg-[#8ecf9f]" : "bg-[#f1d6a8]"}`}
                                style={{ width: `${done ? 100 : pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quiz unlock status */}
                <div
                  className={`rounded-2xl border p-5 font-sans text-sm transition-colors ${
                    allDaysCompleted
                      ? "border-[#8ecf9f]/30 bg-[#1a3328]/60 text-[#c8e8d4]"
                      : "border-white/8 bg-white/[0.02] text-text-secondary"
                  }`}
                >
                  {allDaysCompleted ? (
                    <p className="flex items-center gap-2">
                      <Check size={14} strokeWidth={2.5} />
                      Quiz generation unlocked
                    </p>
                  ) : (
                    <p>{totalDays - completedDays} day{totalDays - completedDays !== 1 ? "s" : ""} remaining to unlock quiz</p>
                  )}
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default SpecificPathView;
