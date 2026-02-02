package handlers

import (
	"curriculumOs/config"
	"net/http"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/endpoints"
	"golang.org/x/oauth2/google"
)

const state = config.Config.STATE

func InitGoogleOauthConfig(w http.ResponseWriter, r *http.Request) *oauth2.Config{
	var cfg *config.Config
	config := &oauth2.Config{
		ClientID:     cfg.GOOGLE_OAUTH_CLIENT_ID,
		ClientSecret: cfg.GOOGLE_OAUTH_CLIENT_SECRET,
		RedirectURL:  "http://localhost:8080/api/oauth/google/callback",
		scopes: []string{},
		Endpoint: google.Endpoint,
	}

	return config
}