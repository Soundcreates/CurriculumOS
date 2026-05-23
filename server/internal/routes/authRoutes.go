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
	authRouter.HandleFunc("/me", handler.Me)
	authRouter.HandleFunc("/session/validate", handler.ValidateSession)
	authRouter.HandleFunc("/logout", handler.Logout)
	authRouter.HandleFunc("/oauth/google/login", handler.GoogleOAuthLogin)
	authRouter.HandleFunc("/oauth/google/callback", handler.GoogleOAuthCallback)
	authRouter.HandleFunc("/oauth/twitter/login", handler.TwitterOAuthLogin)
	authRouter.HandleFunc("/oauth/twitter/callback", handler.TwitterOAuthCallback)
}
