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

	// Render deployments frequently sit behind pgBouncer. Using the simple protocol and
	// disabling prepared statement caching avoids "prepared statement name is already in use" (08P01).
	db, err := gorm.Open(
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
	if err != nil {
		log.Print("Failed to connect to database:", err)
		return nil, err
	}

	return db, nil

}
