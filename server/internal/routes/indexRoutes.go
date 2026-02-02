package routes

import (
	"curriculumOs/internal/handlers"
	"net/http"
)


func RegisterRoutes(handler *handlers.Handler) (*http.ServeMux) {
	mainRouter := http.NewServeMux()

	mainRouter.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	apiRouter := http.NewServeMux()

	mainRouter.Handle("/api/", http.StripPrefix("/api",apiRouter))
	RegisterAuthRoutes(apiRouter, handler)
	return mainRouter
}