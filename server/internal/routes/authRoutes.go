package routes

import (
	"curriculumOs/internal/handlers"
	"net/http"
)

func RegisterAuthRoutes(apiRouter *http.ServeMux, handler *handlers.Handler) {

	authRouter := http.NewServeMux()
	apiRouter.Handle("/auth/", http.StripPrefix("/auth", authRouter))
	authRouter.HandleFunc("/login", handler.Login)
	authRouter.HandleFunc("/register", handler.Register)


	
}