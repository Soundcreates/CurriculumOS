package models

import "time"

type Roadmap struct {
	ID uint `gorm:"primaryKey;autoIncrement" json:"id"`

	Name            string    `json:"name"`
	Description     string    `json:"description"`
	UserGoal        string    `json:"userGoal"`
	TimeQuery       string    `json:"timeQuery"`
	ProcessedTypes  string    `json:"processedTypes"`
	DocumentsCount  int       `json:"documentsCount"`
	RoadmapContent  string    `gorm:"type:text" json:"roadmapContent"`
	ResponsePayload string    `gorm:"type:text" json:"responsePayload"`
	DayProgress     string    `gorm:"type:text" json:"dayProgress"`
	TaskProgress    string    `gorm:"type:text" json:"taskProgress"`
	CreatedAt       time.Time `json:"createdAt"`
	// Nullable to allow safe AutoMigrate on existing tables that may already contain rows.
	AuthorID        uint      `gorm:"index" json:"authorId"`
}
