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

export async function generateQuiz(roadmapId: number) {
  return api.post<GenerateQuizResponse>("/path/generate-quiz", {
    roadmapId,
  });
}
