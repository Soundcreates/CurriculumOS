package config

import (
	"errors"
	"os"
	"strconv"
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
	WORKER_URL                  string
	QSTASH_URL                  string
	QSTASH_TOKEN                string
	INTERNAL_SERVICE_TOKEN      string
	MAX_UPLOAD_BYTES            int64
}

func InitConfig() (*Config, error) {
	if err := godotenv.Load(); err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			// Ignore or propagate the error if it exists but fails to load
		}
	}

	serverURL := getEnv("SERVER_URL", "https://curriculumos-detz.onrender.com")

	cfg := &Config{
		PORT:                        getEnv("PORT", "8080"),
		DATABASE_URL:                strings.TrimSpace(os.Getenv("DATABASE_URL")),
		JWT_SECRET:                  strings.TrimSpace(os.Getenv("JWT_SECRET")),
		STATE:                       strings.TrimSpace(os.Getenv("STATE")),
		SERVER_URL:                  serverURL,
		CLIENT_URL:                  getEnv("CLIENT_URL", "http://127.0.0.1:5173"),
		GOOGLE_OAUTH_CLIENT_ID:      strings.TrimSpace(os.Getenv("GOOGLE_OAUTH_CLIENT_ID")),
		GOOGLE_OAUTH_CLIENT_SECRET:  strings.TrimSpace(os.Getenv("GOOGLE_OAUTH_CLIENT_SECRET")),
		GOOGLE_OAUTH_REDIRECT_URL:   getEnv("GOOGLE_OAUTH_REDIRECT_URL", ""),
		TWITTER_OAUTH_CLIENT_ID:     strings.TrimSpace(os.Getenv("TWITTER_OAUTH_CLIENT_ID")),
		TWITTER_OAUTH_CLIENT_SECRET: strings.TrimSpace(os.Getenv("TWITTER_OAUTH_CLIENT_SECRET")),
		TWITTER_OAUTH_REDIRECT_URL:  getEnv("TWITTER_OAUTH_REDIRECT_URL", ""),
		PYTHON_URL:                  getEnv("PYTHON_URL", "https://curriculumos-1-9w9s.onrender.com"),
		WORKER_URL:                  getEnv("WORKER_URL", getEnv("PYTHON_URL", "http://127.0.0.1:8000")),
		QSTASH_URL:                  getEnv("QSTASH_URL", "https://qstash.upstash.io/v2/publish"),
		QSTASH_TOKEN:                strings.TrimSpace(os.Getenv("QSTASH_TOKEN")),
		INTERNAL_SERVICE_TOKEN:      strings.TrimSpace(os.Getenv("INTERNAL_SERVICE_TOKEN")),
		MAX_UPLOAD_BYTES:            getEnvInt64("MAX_UPLOAD_BYTES", 10<<20),
	}

	return cfg, nil
}

func getEnv(key string, fallback string) string {
	val := fallback
	if value := os.Getenv(key); value != "" {
		val = strings.TrimSpace(value)
	} else {
		val = strings.TrimSpace(fallback)
	}

	// Automatically migrate old suspended Render domain to the new active endpoint
	if strings.Contains(val, "curriculumos.onrender.com") {
		val = strings.ReplaceAll(val, "curriculumos.onrender.com", "curriculumos-detz.onrender.com")
	}

	return val
}

func getEnvInt64(key string, fallback int64) int64 {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}
