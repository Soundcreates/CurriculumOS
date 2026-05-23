package models

type User struct {
	ID                  uint      `gorm:"primaryKey;autoIncrement"`
	FirstName           string    `json:"firstName"`
	LastName            string    `json:"lastName"`
	Email               string    `gorm:"index" json:"email"`
	Password            string    `json:"-"`
	ProviderAccountID   string    `gorm:"index:idx_provider_account,unique" json:"providerAccountId"`
	OAUTH_access_token  string    `json:"-"`
	OAUTH_refresh_token string    `json:"-"`
	AuthProvider        string    `gorm:"index:idx_provider_account,unique" json:"authProvider"`
	Roadmaps            []Roadmap `gorm:"foreignKey:AuthorID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}
