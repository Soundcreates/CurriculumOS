package models

type User struct {
	ID                  uint   `gorm:"primaryKey;autoIncrement"`
	FirstName           string `json:"firstName"`
	LastName            string `json:"lastName"`
	Email               string `gorm:"uniqueIndex" json:"email"`
	Password            string `json:"-"`
	OAUTH_access_token  string `gorm:"uniqueIndex"`
	OAUTH_refresh_token string `gorm:"uniqueIndex"`
	AuthProvider        string `json:"authProvider"`
}
