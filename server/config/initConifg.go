package config

import (
	"errors"
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	PORT                        string
	DATABASE_URL                string
	JWT_SECRET                  string
	STATE                       string
	SERVER_URL                  string
	CLIENT_URL                  string
	GOOGLE_OAUTH_CLIENT_ID      string
	GOOGLE_OAUTH_CLIENT_SECRET  string
	GOOGLE_OAUTH_REDIRECT_URL   string
	TWITTER_OAUTH_CLIENT_ID     string
	TWITTER_OAUTH_CLIENT_SECRET string
	TWITTER_OAUTH_REDIRECT_URL  string
	PYTHON_URL                  string
}

func InitConfig() (*Config, error) {
	log.Println("Initializing configuration...")

	if err := godotenv.Load(); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			log.Print(".env file not found, using environment variables")
		} else {
			log.Printf("Failed to load .env file: %v", err)
		}
	}

	serverURL := getEnv("SERVER_URL", "http://127.0.0.1:8080")

	cfg := &Config{
		PORT:                        getEnv("PORT", "8080"),
		DATABASE_URL:                strings.TrimSpace(os.Getenv("DATABASE_URL")),
		JWT_SECRET:                  strings.TrimSpace(os.Getenv("JWT_SECRET")),
		STATE:                       strings.TrimSpace(os.Getenv("STATE")),
		SERVER_URL:                  serverURL,
		CLIENT_URL:                  getEnv("CLIENT_URL", "http://127.0.0.1:5173"),
		GOOGLE_OAUTH_CLIENT_ID:      strings.TrimSpace(os.Getenv("GOOGLE_OAUTH_CLIENT_ID")),
		GOOGLE_OAUTH_CLIENT_SECRET:  strings.TrimSpace(os.Getenv("GOOGLE_OAUTH_CLIENT_SECRET")),
		GOOGLE_OAUTH_REDIRECT_URL:   getEnv("GOOGLE_OAUTH_REDIRECT_URL", serverURL+"/api/auth/oauth/google/callback"),
		TWITTER_OAUTH_CLIENT_ID:     strings.TrimSpace(os.Getenv("TWITTER_OAUTH_CLIENT_ID")),
		TWITTER_OAUTH_CLIENT_SECRET: strings.TrimSpace(os.Getenv("TWITTER_OAUTH_CLIENT_SECRET")),
		TWITTER_OAUTH_REDIRECT_URL:  getEnv("TWITTER_OAUTH_REDIRECT_URL", serverURL+"/api/auth/oauth/twitter/callback"),
		PYTHON_URL:                  getEnv("PYTHON_URL", "http://localhost:8000"),
	}

	return cfg, nil
}

func getEnv(key string, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return strings.TrimSpace(value)
	}

	return strings.TrimSpace(fallback)
}
