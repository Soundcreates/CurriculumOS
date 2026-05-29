package main

import (
	"curriculumOs/config"
	"curriculumOs/db"
	"curriculumOs/db/models"
	"curriculumOs/internal/handlers"
	"curriculumOs/internal/routes"
	"fmt"
	"net/http"

	"github.com/rs/cors"
)

func main() {
	cfg, err := config.InitConfig()
	if err != nil {
		panic(err)
	}

	db, err := db.InitDB(cfg)
	if err != nil {
		panic(err)
	}

	db.AutoMigrate(models.User{}, models.Roadmap{}, models.QuizResult{})
	handler := handlers.NewHandler(db, cfg)

	mux := routes.RegisterRoutes(handler)

	allowedOrigins := []string{
		cfg.CLIENT_URL,
		cfg.PYTHON_URL,
		"http://localhost:5173",
		"http://127.0.0.1:5173",
	}
	corsHandler := cors.New(cors.Options{
		AllowedOrigins: allowedOrigins,
		AllowedHeaders: []string{
			"Authorization",
			"Content-Type",
		},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowCredentials: true,
	})

	handler2 := corsHandler.Handler(mux)
	addr := fmt.Sprintf(":%s", cfg.PORT)

	err = http.ListenAndServe(addr, handler2)
	if err != nil {
		panic(err)
	}
}
