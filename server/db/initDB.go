package db

import (
	"curriculumOs/config"
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)


func InitDB(cfg *config.Config) (*gorm.DB, error) {
	log.Println("Initializing database...")
	database_url := cfg.DATABASE_URL
	
	db,err := gorm.Open(postgres.Open(database_url))
	if err !=nil {
		log.Print("Failed to connect to database:", err)
		return nil, err
	}

	return db,nil

}