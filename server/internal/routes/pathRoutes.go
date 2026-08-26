package routes

import (
	"curriculumOs/internal/handlers"
	"net/http"
	"strings"
)

func RegisterPathRoutes(router *http.ServeMux, handler *handlers.Handler) {
	pathRouter := http.NewServeMux()

	router.Handle("/path/", http.StripPrefix("/path", pathRouter))

	pathRouter.HandleFunc("/create", handler.CreateGenerationJob)
	pathRouter.HandleFunc("/generation-jobs/failed", handler.ListFailedGenerationJobs)
	pathRouter.HandleFunc("/generation-jobs/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/retry") {
			handler.RetryGenerationJob(w, r)
			return
		}
		handler.GetGenerationJob(w, r)
	})
	pathRouter.HandleFunc("/getPaths", handler.GetPaths)
	pathRouter.HandleFunc("/stats", handler.GetStats)
	pathRouter.HandleFunc("/day-progress", handler.UpdateDayProgress)
	pathRouter.HandleFunc("/task-progress", handler.UpdateTaskProgress)
	pathRouter.HandleFunc("/feedback", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			handler.GetRoadmapFeedback(w, r)
			return
		}
		handler.SaveRoadmapFeedback(w, r)
	})
	pathRouter.HandleFunc("/resources", handler.FetchResources)
	pathRouter.HandleFunc("/generate-quiz", handler.GenerateQuiz)
	pathRouter.HandleFunc("/quiz-submission", handler.SubmitQuiz)
	pathRouter.HandleFunc("/quiz-results", handler.GetQuizResults)

}
