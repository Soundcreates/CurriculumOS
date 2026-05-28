package routes

import (
	"curriculumOs/internal/handlers"
	"net/http"
)

func RegisterPathRoutes(router *http.ServeMux, handler *handlers.Handler) {
	pathRouter := http.NewServeMux()

	router.Handle("/path/", http.StripPrefix("/path", pathRouter))

	pathRouter.HandleFunc("/create", handler.CreatePath)
	pathRouter.HandleFunc("/getPaths", handler.GetPaths)
	pathRouter.HandleFunc("/stats", handler.GetStats)
	pathRouter.HandleFunc("/day-progress", handler.UpdateDayProgress)
	pathRouter.HandleFunc("/task-progress", handler.UpdateTaskProgress)
	pathRouter.HandleFunc("/resources", handler.FetchResources)
	pathRouter.HandleFunc("/generate-quiz", handler.GenerateQuiz)

}
