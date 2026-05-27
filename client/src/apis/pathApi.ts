import api from "../service/baseUrl";

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

export type CreatePathPythonResponse = {
  success: boolean;
  message: string;
  roadmap: string;
  user_goal: string;
  time_query: string;
  processed_types: string[];
  documents_count: number;
};

export type CreatePathResponse = {
  success: boolean;
  message: string;
  python_response: CreatePathPythonResponse;
  roadmap_id?: number;
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

export function createPath(payload: FormData) {
  return api.post<CreatePathResponse>("/path/create", payload, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
}

export async function getAllPaths(): Promise<Roadmap[]> {
  try {
    const response = await api.get<GetAllPathsResponse>("/path/getPaths");

    if (response.data.success) {
      console.log("no of roadmaps: ", response.data.roadmaps.length);
      return response.data.roadmaps;
    }
    return [];
  } catch (err) {
    console.log("Error happened while calling getAllPaths api: ", err);
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
