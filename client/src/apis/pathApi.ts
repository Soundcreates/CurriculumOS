import api, { isServiceUnavailableError } from "../service/baseUrl";
import { AxiosError } from "axios";

export type Roadmap = {
  id: number;
  name: string;
  description: string;
  userGoal: string;
  timeQuery: string;
  processedTypes: string;
  documentsCount: number;
  roadmapContent: string;
  responsePayload: string;
  dayProgress?: string;
  taskProgress?: string;
  createdAt: string;
  authorId: number;
};

export type CreatePathResponse = {
  success: boolean;
  jobId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  roadmapId?: number;
  errorMessage?: string;
  userGoal?: string;
  createdAt: string;
  updatedAt: string;
};

export type GenerationRequestError = Error & { jobId?: string };

export type RoadmapFeedback = {
  id: number;
  roadmapId: number;
  citationRating: number;
  taskUsefulnessRating: number;
  completionStatus: "not_started" | "in_progress" | "completed" | "stopped";
  completionPercent: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
};

export type GetAllPathsResponse = {
  success: boolean;
  roadmaps: Roadmap[];
};

export type DayProgressEntry = {
  dayLabel: string;
  completed: boolean;
};

export type UpdateDayProgressResponse = {
  success: boolean;
  dayProgress: DayProgressEntry[];
};

export type QuizQuestion = {
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
};

export type GenerateQuizResponse = {
  success: boolean;
  quiz: string;
};

export type QuizSubmissionPayload = {
  roadmapId: number;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  questions: QuizQuestion[];
  userAnswers: Record<number, string>;
};

export type SubmitQuizResponse = {
  success: boolean;
  message: string;
  result: {
    id: number;
    score: number;
    correctAnswers: number;
    totalQuestions: number;
    createdAt: string;
  };
};

export type QuizResultItem = {
  id: number;
  roadmapId: number;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  questions: QuizQuestion[];
  userAnswers: Record<number, string>;
  createdAt: string;
};

export type GetQuizResultsResponse = {
  success: boolean;
  results: QuizResultItem[];
};

export type TaskProgressEntry = {
  dayLabel: string;
  taskIndex: number;
  completed: boolean;
};

export type UpdateTaskProgressResponse = {
  success: boolean;
  taskProgress: TaskProgressEntry[];
};

export type ResourceItem = {
  type: "video" | "article";
  title: string;
  url: string;
  thumbnail?: string;
  description?: string;
};

export type FetchResourcesResponse = {
  success: boolean;
  resources: Record<string, ResourceItem[]>;
};

export type PathStatItem = {
  id: number;
  name: string;
  progress: number;
  totalDays: number;
  completedDays: number;
};

export type CompletedPathItem = {
  id: number;
  name: string;
  totalDays: number;
  createdAt: string;
};

export type DistributionEntry = {
  name: string;
  value: number;
};

export type WeeklyEntry = {
  label: string;
  completed: number;
  created: number;
};

export type MonthlyEntry = {
  month: string;
  focus: number;
  completion: number;
};

export type UserStats = {
  totalPaths: number;
  completedPaths: number;
  inProgressPaths: number;
  queuedPaths: number;
  completionRate: number;
  activePaths: PathStatItem[];
  completedList: CompletedPathItem[];
  distribution: DistributionEntry[];
  weeklyClosures: WeeklyEntry[];
  monthlyActivity: MonthlyEntry[];
  currentFocus: string;
};

export type GetUserStatsResponse = {
  success: boolean;
  stats: UserStats;
};

export async function getUserStats(): Promise<UserStats | null> {
  try {
    const response = await api.get<GetUserStatsResponse>("/path/stats");
    if (response.data.success) {
      return response.data.stats;
    }
    return null;
  } catch {
    return null;
  }
}

export async function createPath(payload: FormData) {
  try {
    return await api.post<CreatePathResponse>("/path/create", payload, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  } catch (error) {
    if (isServiceUnavailableError(error)) {
      if (error instanceof AxiosError) {
        const payload = error.response?.data as { error?: string; detail?: string; jobId?: string } | undefined;
        const message = payload?.error || payload?.detail;
        if (message) {
          const requestError = new Error(message) as GenerationRequestError;
          requestError.jobId = payload?.jobId;
          throw requestError;
        }
      }
      throw new Error("Generation service is temporarily unavailable. Please retry.");
    }
    throw error;
  }
}

export async function getGenerationJob(jobId: string): Promise<CreatePathResponse> {
  const response = await api.get<CreatePathResponse>(`/path/generation-jobs/${jobId}`);
  return response.data;
}

export async function retryGenerationJob(jobId: string): Promise<CreatePathResponse> {
  const response = await api.post<CreatePathResponse>(`/path/generation-jobs/${jobId}/retry`);
  return response.data;
}

export async function getFailedGenerationJobs(): Promise<CreatePathResponse[]> {
  const response = await api.get<{ success: boolean; jobs: CreatePathResponse[] }>("/path/generation-jobs/failed");
  return response.data.jobs ?? [];
}

export async function getRoadmapFeedback(roadmapId: number): Promise<RoadmapFeedback | null> {
  const response = await api.get<{ success: boolean; feedback: RoadmapFeedback | null }>("/path/feedback", {
    params: { roadmapId },
  });
  return response.data.feedback ?? null;
}

export async function saveRoadmapFeedback(
  roadmapId: number,
  payload: Omit<RoadmapFeedback, "id" | "roadmapId" | "completionPercent" | "createdAt" | "updatedAt">,
): Promise<RoadmapFeedback> {
  const response = await api.put<{ success: boolean; feedback: RoadmapFeedback }>("/path/feedback", {
    roadmapId,
    ...payload,
  });
  return response.data.feedback;
}

export async function getAllPaths(): Promise<Roadmap[]> {
  try {
    const response = await api.get<GetAllPathsResponse>("/path/getPaths");

    if (response.data.success) {
      return response.data.roadmaps;
    }
    return [];
  } catch {
    return [];
  }
}

export async function updateDayProgress(
  roadmapId: number,
  dayLabel: string,
  completed: boolean,
) {
  return api.patch<UpdateDayProgressResponse>("/path/day-progress", {
    roadmapId,
    dayLabel,
    completed,
  });
}

export async function updateTaskProgress(
  roadmapId: number,
  dayLabel: string,
  taskIndex: number,
  completed: boolean,
) {
  return api.patch<UpdateTaskProgressResponse>("/path/task-progress", {
    roadmapId,
    dayLabel,
    taskIndex,
    completed,
  });
}

export async function fetchDayResources(
  topics: string[],
  userGoal: string,
): Promise<Record<string, ResourceItem[]>> {
  try {
    const response = await api.post<FetchResourcesResponse>("/path/resources", {
      topics,
      user_goal: userGoal,
    });
    if (response.data.success) {
      return response.data.resources;
    }
    return {};
  } catch {
    return {};
  }
}

export async function generateQuiz(
  roadmapId: number,
  difficultyTiers: number,
  questionsPerTier: number,
) {
  return api.post<GenerateQuizResponse>("/path/generate-quiz", {
    roadmapId,
    difficultyTiers,
    questionsPerTier,
  });
}

export async function submitQuiz(payload: QuizSubmissionPayload) {
  return api.post<SubmitQuizResponse>("/path/quiz-submission", payload);
}

export async function getQuizResults(roadmapId: number) {
  try {
    const response = await api.get<GetQuizResultsResponse>("/path/quiz-results", {
      params: { roadmapId },
    });
    if (response.data.success) {
      return response.data.results;
    }
    return [];
  } catch {
    return [];
  }
}
