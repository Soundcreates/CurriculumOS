package db

import (
	"curriculumOs/config"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func InitDB(cfg *config.Config) (*gorm.DB, error) {
	database_url := cfg.DATABASE_URL

	var db *gorm.DB
	var err error

	for i := 1; i <= 10; i++ {
		db, err = gorm.Open(
			postgres.New(postgres.Config{
				DSN:                  database_url,
				PreferSimpleProtocol: true,
			}),
			&gorm.Config{
				PrepareStmt: false,
				Logger:      logger.Default.LogMode(logger.Silent),
			},
		)
		if err == nil {
			return db, nil
		}
		time.Sleep(2 * time.Second)
	}

	return nil, err
}
