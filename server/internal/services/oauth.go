package services

import (
	"context"
	"curriculumOs/config"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

const (
	twitterAuthorizeURL = "https://x.com/i/oauth2/authorize"
	twitterTokenURL     = "https://api.twitter.com/2/oauth2/token"
)

type OAuthService struct {
	cfg        *config.Config
	httpClient *http.Client
}

type OAuthUserProfile struct {
	Provider       string
	ProviderUserID string
	Email          string
	FirstName      string
	LastName       string
	AccessToken    string
	RefreshToken   string
}

func NewOAuthService(cfg *config.Config) *OAuthService {
	return &OAuthService{
		cfg:        cfg,
		httpClient: http.DefaultClient,
	}
}

func (s *OAuthService) GoogleConfig() *oauth2.Config {
	return &oauth2.Config{
		ClientID:     s.cfg.GOOGLE_OAUTH_CLIENT_ID,
		ClientSecret: s.cfg.GOOGLE_OAUTH_CLIENT_SECRET,
		RedirectURL:  s.cfg.GOOGLE_OAUTH_REDIRECT_URL,
		Scopes: []string{
			"https://www.googleapis.com/auth/userinfo.email",
			"https://www.googleapis.com/auth/userinfo.profile",
		},
		Endpoint: google.Endpoint,
	}
}

func (s *OAuthService) GoogleConfigForRedirect(redirectURL string) *oauth2.Config {
	config := s.GoogleConfig()
	if strings.TrimSpace(redirectURL) != "" {
		config.RedirectURL = strings.TrimSpace(redirectURL)
	}

	return config
}

func (s *OAuthService) TwitterConfig() *oauth2.Config {
	return &oauth2.Config{
		ClientID:     s.cfg.TWITTER_OAUTH_CLIENT_ID,
		ClientSecret: s.cfg.TWITTER_OAUTH_CLIENT_SECRET,
		RedirectURL:  s.cfg.TWITTER_OAUTH_REDIRECT_URL,
		Scopes: []string{
			"users.read",
			"tweet.read",
			"offline.access",
		},
		Endpoint: oauth2.Endpoint{
			AuthURL:  twitterAuthorizeURL,
			TokenURL: twitterTokenURL,
		},
	}
}

func (s *OAuthService) TwitterConfigForRedirect(redirectURL string) *oauth2.Config {
	config := s.TwitterConfig()
	if strings.TrimSpace(redirectURL) != "" {
		config.RedirectURL = strings.TrimSpace(redirectURL)
	}

	return config
}

func (s *OAuthService) ExchangeGoogleProfile(ctx context.Context, code string, redirectURL string) (*OAuthUserProfile, error) {
	token, err := s.GoogleConfigForRedirect(redirectURL).Exchange(ctx, code)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)

	var payload struct {
		ID         string `json:"id"`
		Email      string `json:"email"`
		GivenName  string `json:"given_name"`
		FamilyName string `json:"family_name"`
		Name       string `json:"name"`
	}

	if err := s.doJSON(req, &payload); err != nil {
		return nil, err
	}

	firstName, lastName := coalesceNames(payload.GivenName, payload.FamilyName, payload.Name)

	return &OAuthUserProfile{
		Provider:       "google",
		ProviderUserID: payload.ID,
		Email:          payload.Email,
		FirstName:      firstName,
		LastName:       lastName,
		AccessToken:    token.AccessToken,
		RefreshToken:   token.RefreshToken,
	}, nil
}

func (s *OAuthService) ExchangeTwitterProfile(ctx context.Context, code string, verifier string, redirectURL string) (*OAuthUserProfile, error) {
	token, err := s.TwitterConfigForRedirect(redirectURL).Exchange(ctx, code, oauth2.SetAuthURLParam("code_verifier", verifier))
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.twitter.com/2/users/me?user.fields=id,name,username", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)

	var payload struct {
		Data struct {
			ID       string `json:"id"`
			Name     string `json:"name"`
			Username string `json:"username"`
		} `json:"data"`
	}

	if err := s.doJSON(req, &payload); err != nil {
		return nil, err
	}

	firstName, lastName := splitName(payload.Data.Name)
	if firstName == "" {
		firstName = payload.Data.Username
	}

	return &OAuthUserProfile{
		Provider:       "twitter",
		ProviderUserID: payload.Data.ID,
		FirstName:      firstName,
		LastName:       lastName,
		AccessToken:    token.AccessToken,
		RefreshToken:   token.RefreshToken,
	}, nil
}

func (s *OAuthService) doJSON(req *http.Request, target any) error {
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return errors.New("oauth provider returned a non-success response")
	}

	return json.NewDecoder(resp.Body).Decode(target)
}

func coalesceNames(firstName string, lastName string, fullName string) (string, string) {
	if firstName != "" || lastName != "" {
		return firstName, lastName
	}

	return splitName(fullName)
}

func splitName(fullName string) (string, string) {
	parts := strings.Fields(strings.TrimSpace(fullName))
	if len(parts) == 0 {
		return "", ""
	}
	if len(parts) == 1 {
		return parts[0], ""
	}

	return parts[0], strings.Join(parts[1:], " ")
}
