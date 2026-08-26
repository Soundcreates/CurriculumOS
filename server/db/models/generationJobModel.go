package models

import "time"

const (
	GenerationJobQueued    = "queued"
	GenerationJobRunning   = "running"
	GenerationJobSucceeded = "succeeded"
	GenerationJobFailed    = "failed"
)

// GenerationJob keeps the request durable while a managed worker creates a roadmap.
// InputPayload is intentionally short-lived beta storage; move large originals to object storage
// before increasing MAX_UPLOAD_BYTES beyond the documented limit.
type GenerationJob struct {
	ID             string    `gorm:"primaryKey;size:36" json:"id"`
	AuthorID       uint      `gorm:"index;not null" json:"authorId"`
	Status         string    `gorm:"index;size:16;not null" json:"status"`
	InputPayload   string    `gorm:"type:text;not null" json:"-"`
	UserGoal       string    `gorm:"type:text;not null" json:"userGoal"`
	TimeQuery      string    `gorm:"size:128;not null" json:"timeQuery"`
	ProcessedTypes string    `gorm:"size:128" json:"processedTypes"`
	RoadmapID      *uint     `gorm:"index" json:"roadmapId,omitempty"`
	ErrorMessage   string    `gorm:"type:text" json:"errorMessage,omitempty"`
	Attempts       int       `gorm:"not null;default:0" json:"attempts"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}
