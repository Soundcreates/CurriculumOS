package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"curriculumOs/config"
	"curriculumOs/internal/services"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"

	"golang.org/x/oauth2"
)

const (
	oauthStateCookie   = "oauth_state"
	twitterPKCECookie  = "twitter_pkce_verifier"
	authTokenCookie    = "auth_token"
	callbackStatusFail = "failed"
)

func (h *Handler) GoogleOAuthLogin(w http.ResponseWriter, r *http.Request) {
	oauthState, err := newOAuthState(h.cfg)
	if err != nil {
		writeOAuthError(w, http.StatusInternalServerError, "failed to initialize oauth state")
		return
	}

	setCookie(w, r, oauthStateCookie, oauthState)

	authURL := services.NewOAuthService(h.cfg).GoogleConfig().AuthCodeURL(
		oauthState,
		oauth2.AccessTypeOffline,
		oauth2.SetAuthURLParam("prompt", "consent"),
	)

	http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
}

func (h *Handler) GoogleOAuthCallback(w http.ResponseWriter, r *http.Request) {
	if !validateOAuthState(r, h.cfg) {
		h.redirectOAuthFailure(w, r, "invalid_state")
		return
	}

	profile, err := services.NewOAuthService(h.cfg).ExchangeGoogleProfile(r.Context(), r.URL.Query().Get("code"))
	if err != nil {
		h.redirectOAuthFailure(w, r, "google_exchange_failed")
		return
	}

	h.completeOAuthLogin(w, r, profile)
}

func (h *Handler) TwitterOAuthLogin(w http.ResponseWriter, r *http.Request) {
	oauthState, err := newOAuthState(h.cfg)
	if err != nil {
		writeOAuthError(w, http.StatusInternalServerError, "failed to initialize oauth state")
		return
	}

	verifier, challenge, err := newPKCEPair()
	if err != nil {
		writeOAuthError(w, http.StatusInternalServerError, "failed to initialize pkce verifier")
		return
	}

	setCookie(w, r, oauthStateCookie, oauthState)
	setCookie(w, r, twitterPKCECookie, verifier)

	authURL := services.NewOAuthService(h.cfg).TwitterConfig().AuthCodeURL(
		oauthState,
		oauth2.AccessTypeOffline,
		oauth2.SetAuthURLParam("code_challenge", challenge),
		oauth2.SetAuthURLParam("code_challenge_method", "S256"),
	)

	http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
}

func (h *Handler) TwitterOAuthCallback(w http.ResponseWriter, r *http.Request) {
	if !validateOAuthState(r, h.cfg) {
		h.redirectOAuthFailure(w, r, "invalid_state")
		return
	}

	verifier, err := readCookie(r, twitterPKCECookie)
	if err != nil {
		h.redirectOAuthFailure(w, r, "missing_verifier")
		return
	}

	profile, err := services.NewOAuthService(h.cfg).ExchangeTwitterProfile(r.Context(), r.URL.Query().Get("code"), verifier)
	if err != nil {
		h.redirectOAuthFailure(w, r, "twitter_exchange_failed")
		return
	}

	h.completeOAuthLogin(w, r, profile)
}

func (h *Handler) completeOAuthLogin(w http.ResponseWriter, r *http.Request, profile *services.OAuthUserProfile) {
	user, err := services.UpsertOAuthUser(h.db, *profile)
	if err != nil {
		h.redirectOAuthFailure(w, r, "user_persistence_failed")
		return
	}

	token, err := services.IssueAuthToken(h.cfg, user)
	if err != nil {
		h.redirectOAuthFailure(w, r, "token_issue_failed")
		return
	}

	clearCookie(w, r, oauthStateCookie)
	clearCookie(w, r, twitterPKCECookie)
	setCookie(w, r, authTokenCookie, token)

	redirectURL, err := url.Parse(strings.TrimRight(h.cfg.CLIENT_URL, "/") + "/dashboard")
	if err != nil {
		writeOAuthError(w, http.StatusInternalServerError, "invalid client url")
		return
	}

	values := redirectURL.Query()
	values.Set("provider", profile.Provider)
	values.Set("status", "success")
	redirectURL.RawQuery = values.Encode()

	http.Redirect(w, r, redirectURL.String(), http.StatusTemporaryRedirect)
}

func (h *Handler) redirectOAuthFailure(w http.ResponseWriter, r *http.Request, reason string) {
	clearCookie(w, r, oauthStateCookie)
	clearCookie(w, r, twitterPKCECookie)

	redirectURL, err := url.Parse(strings.TrimRight(h.cfg.CLIENT_URL, "/") + "/login")
	if err != nil {
		writeOAuthError(w, http.StatusInternalServerError, "invalid client url")
		return
	}

	values := redirectURL.Query()
	values.Set("status", callbackStatusFail)
	values.Set("reason", reason)
	redirectURL.RawQuery = values.Encode()

	http.Redirect(w, r, redirectURL.String(), http.StatusTemporaryRedirect)
}

func newOAuthState(cfg *config.Config) (string, error) {
	if strings.TrimSpace(cfg.STATE) != "" {
		return cfg.STATE, nil
	}

	return randomToken(32)
}

func newPKCEPair() (string, string, error) {
	verifier, err := randomToken(48)
	if err != nil {
		return "", "", err
	}

	sum := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(sum[:])

	return verifier, challenge, nil
}

func randomToken(size int) (string, error) {
	raw := make([]byte, size)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func validateOAuthState(r *http.Request, cfg *config.Config) bool {
	stateFromQuery := r.URL.Query().Get("state")
	if stateFromQuery == "" {
		return false
	}

	stateFromCookie, err := readCookie(r, oauthStateCookie)
	if err != nil {
		return false
	}

	return stateFromQuery == stateFromCookie && (cfg.STATE == "" || stateFromCookie == cfg.STATE)
}

func setCookie(w http.ResponseWriter, r *http.Request, name string, value string) {
	http.SetCookie(w, &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   r.TLS != nil,
	})
}

func clearCookie(w http.ResponseWriter, r *http.Request, name string) {
	http.SetCookie(w, &http.Cookie{
		Name:     name,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   r.TLS != nil,
	})
}

func readCookie(r *http.Request, name string) (string, error) {
	cookie, err := r.Cookie(name)
	if err != nil {
		return "", err
	}
	if cookie.Value == "" {
		return "", errors.New("cookie is empty")
	}

	return cookie.Value, nil
}

func writeOAuthError(w http.ResponseWriter, statusCode int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error": message,
	})
}
