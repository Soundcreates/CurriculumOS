package models

import "time"

type QuizResult struct {
	ID         uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	RoadmapID  uint      `gorm:"index" json:"roadmapId"`
	Roadmap    Roadmap   `gorm:"foreignKey:RoadmapID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
	AuthorID   uint      `gorm:"index" json:"authorId"`
	Author     User      `gorm:"foreignKey:AuthorID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
	Score      int       `json:"score"`
	TotalQuestions int  `json:"totalQuestions"`
	CorrectAnswers int `json:"correctAnswers"`
	QuizData   string    `gorm:"type:text" json:"quizData"`
	UserAnswers string   `gorm:"type:text" json:"userAnswers"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}
