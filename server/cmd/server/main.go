package main

import (
	"curriculumOs/config"
	"curriculumOs/db"
	"curriculumOs/db/models"
	"curriculumOs/internal/handlers"
	"curriculumOs/internal/routes"
	"fmt"
	"log"
	"net/http"

	"github.com/rs/cors"
)

func main() {
	fmt.Println("Hello world")

	cfg, err := config.InitConfig()
	if err != nil {
		log.Fatal("Failed to initialize configuration:", err)
	}

	db, err := db.InitDB(cfg)
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}

	db.AutoMigrate(models.User{}, models.Roadmap{}, models.QuizResult{})
	handler := handlers.NewHandler(db, cfg)

	mux := routes.RegisterRoutes(handler)

	allowedOrigins := []string{
		cfg.CLIENT_URL,
		cfg.PYTHON_URL,
		"http://localhost:5173",
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
	log.Printf("Starting server on port %s", cfg.PORT)
	addr := fmt.Sprintf(":%s", cfg.PORT)

	err = http.ListenAndServe(addr, handler2)
	if err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
