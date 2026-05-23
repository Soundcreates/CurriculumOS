package handlers

import (
	"curriculumOs/config"

	"gorm.io/gorm"
)

type Handler struct{
	db *gorm.DB
	cfg *config.Config
}

func NewHandler(db *gorm.DB, cfg *config.Config) *Handler {
	return &Handler{
		db: db,
		cfg: cfg,
	}
}