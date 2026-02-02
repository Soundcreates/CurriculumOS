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
	GOOGLE_OAUTH_CLIENT_ID string
	GOOGLE_OAUTH_CLIENT_SECRET string
	DATABASE_URL string
	STATE string
	JWT_SECRET string 
} 
	
func InitConfig() ( *Config, error) { log.Println("Initializing configuration...") err := godotenv.Load()
	if err !=nil {
		log.Print("Error loading .env file")
		return nil, err
	}
	cfg := &Config {
		PORT: os.Getenv("PORT"),
		GOOGLE_OAUTH_CLIENT_ID: os.Getenv("GOOGLE_OAUTH_CLIENT_ID"),
		GOOGLE_OAUTH_CLIENT_SECRET: os.Getenv("GOOGLE_OAUTH_CLIENT_SECRET"),
		STATE: os.Getenv("STATE"),
		JWT_SECRET: os.Getenv("JWT_SECRET"),
		DATABASE_URL: os.Getenv("DATABASE_URL"),
	}
	return cfg, nil
}