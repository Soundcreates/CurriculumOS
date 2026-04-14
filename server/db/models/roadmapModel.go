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
	CreatedAt       time.Time `json:"createdAt"`
}
