package db

import (
	"curriculumOs/config"
	"log"
	"os"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func InitDB(cfg *config.Config) (*gorm.DB, error) {
	log.Println("Initializing database...")
	database_url := cfg.DATABASE_URL

	var db *gorm.DB
	var err error

	for i := 1; i <= 10; i++ {
		log.Printf("Connecting to database (attempt %d/10)...", i)
		db, err = gorm.Open(
			postgres.New(postgres.Config{
				DSN:                  database_url,
				PreferSimpleProtocol: true,
			}),
			&gorm.Config{
				PrepareStmt: false,
				Logger: logger.New(
					log.New(os.Stdout, "\r\n", log.LstdFlags),
					logger.Config{
						SlowThreshold:             200 * time.Millisecond,
						LogLevel:                  logger.Warn,
						IgnoreRecordNotFoundError: true,
						Colorful:                  false,
					},
				),
			},
		)
		if err == nil {
			log.Println("Successfully connected to database!")
			return db, nil
		}
		log.Printf("Failed to connect to database (attempt %d/10): %v", i, err)
		time.Sleep(2 * time.Second)
	}

	return nil, err

}
