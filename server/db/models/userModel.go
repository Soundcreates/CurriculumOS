package models

import(
	"gorm.io/gorm"
)

type User struct {
	userID uint `gorm:"primaryKey;autoIncrement"`
	FirstName string
	LastName string
	Email string `gorm:"uniqueIndex"`
	Password string
	OAUTH_access_token string `gorm:"uniqueIndex"`
	OAUTH_refresh_token string `gorm:"uniqueIndex"`	
}