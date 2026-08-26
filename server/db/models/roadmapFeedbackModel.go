package models

import "time"

// RoadmapFeedback stores one editable product-quality response per user and roadmap.
type RoadmapFeedback struct {
	ID                   uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	RoadmapID            uint      `gorm:"uniqueIndex:idx_roadmap_feedback_owner;not null" json:"roadmapId"`
	AuthorID             uint      `gorm:"uniqueIndex:idx_roadmap_feedback_owner;not null" json:"authorId"`
	CitationRating       int       `json:"citationRating"`
	TaskUsefulnessRating int       `json:"taskUsefulnessRating"`
	CompletionStatus     string    `gorm:"size:24;not null" json:"completionStatus"`
	CompletionPercent    int       `json:"completionPercent"`
	Comment              string    `gorm:"type:text" json:"comment"`
	CreatedAt            time.Time `json:"createdAt"`
	UpdatedAt            time.Time `json:"updatedAt"`
}
