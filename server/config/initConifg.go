package config

import (
	"log"
	"os"

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
}

func InitConfig() (*Config, error) {
	log.Println("Initializing configuration...")

	if err := godotenv.Load(); err != nil {
		log.Print("Error loading .env file")
		return nil, err
	}

	serverURL := getEnv("SERVER_URL", "http://localhost:8080")

	cfg := &Config{
		PORT:                        getEnv("PORT", ":8080"),
		DATABASE_URL:                os.Getenv("DATABASE_URL"),
		JWT_SECRET:                  os.Getenv("JWT_SECRET"),
		STATE:                       os.Getenv("STATE"),
		SERVER_URL:                  serverURL,
		CLIENT_URL:                  getEnv("CLIENT_URL", "http://localhost:5173"),
		GOOGLE_OAUTH_CLIENT_ID:      os.Getenv("GOOGLE_OAUTH_CLIENT_ID"),
		GOOGLE_OAUTH_CLIENT_SECRET:  os.Getenv("GOOGLE_OAUTH_CLIENT_SECRET"),
		GOOGLE_OAUTH_REDIRECT_URL:   getEnv("GOOGLE_OAUTH_REDIRECT_URL", serverURL+"/api/auth/oauth/google/callback"),
		TWITTER_OAUTH_CLIENT_ID:     os.Getenv("TWITTER_OAUTH_CLIENT_ID"),
		TWITTER_OAUTH_CLIENT_SECRET: os.Getenv("TWITTER_OAUTH_CLIENT_SECRET"),
		TWITTER_OAUTH_REDIRECT_URL:  getEnv("TWITTER_OAUTH_REDIRECT_URL", serverURL+"/api/auth/oauth/twitter/callback"),
	}

	return cfg, nil
}

func getEnv(key string, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}

	return fallback
}
