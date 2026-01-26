package config

import(
	"os"
	"log"
	"github.com/joho/godotenv"
)

type Config struct {
	PORT string
	OAUTH_CLIENT_ID string
	OAUTH_CLIENT_SECRET string
	DATABASE_URL string
}
func InitConfig() ( *Config, error) {
	log.Println("Initializing configuration...")
	err := godotenv.Load()
	if err !=nil {
		log.Print("Error loading .env file")
		return nil, err
	}
	cfg := &Config {
		PORT: os.Getenv("PORT"),
		OAUTH_CLIENT_ID: os.Getenv("OAUTH_CLIENT_ID"),
		OAUTH_CLIENT_SECRET: os.Getenv("OAUTH_CLIENT_SECRET"),
		DATABASE_URL: os.Getenv("DATABASE_URL"),
	}
	return cfg, nil
}