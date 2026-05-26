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
	oauthService := services.NewOAuthService(h.cfg)
	callbackURL := oauthCallbackURL(r, h.cfg, "google")

	authURL := oauthService.GoogleConfigForRedirect(callbackURL).AuthCodeURL(
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

	callbackURL := oauthCallbackURL(r, h.cfg, "google")
	profile, err := services.NewOAuthService(h.cfg).ExchangeGoogleProfile(r.Context(), r.URL.Query().Get("code"), callbackURL)
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
	oauthService := services.NewOAuthService(h.cfg)
	callbackURL := oauthCallbackURL(r, h.cfg, "twitter")

	authURL := oauthService.TwitterConfigForRedirect(callbackURL).AuthCodeURL(
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

	callbackURL := oauthCallbackURL(r, h.cfg, "twitter")
	profile, err := services.NewOAuthService(h.cfg).ExchangeTwitterProfile(r.Context(), r.URL.Query().Get("code"), verifier, callbackURL)
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
	sameSite, secure := cookiePolicy(r)
	http.SetCookie(w, &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		HttpOnly: true,
		SameSite: sameSite,
		Secure:   secure,
	})
}

func clearCookie(w http.ResponseWriter, r *http.Request, name string) {
	sameSite, secure := cookiePolicy(r)
	http.SetCookie(w, &http.Cookie{
		Name:     name,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: sameSite,
		Secure:   secure,
	})
}

func cookiePolicy(r *http.Request) (http.SameSite, bool) {
	clientOrigin := strings.TrimSpace(r.Header.Get("Origin"))
	clientReferer := strings.TrimSpace(r.Header.Get("Referer"))

	// Use request host/proxy hints for secure detection behind TLS-terminating proxies.
	secure := r.TLS != nil || strings.EqualFold(strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")), "https")
	if !secure {
		if strings.HasPrefix(strings.ToLower(strings.TrimSpace(r.Host)), "localhost") {
			secure = false
		}
	}

	// If request is cross-site (different site from API host), cookie must be SameSite=None
	// on HTTPS. On plain HTTP (typically local dev), SameSite=None would be rejected because
	// browsers require Secure for None, so we fall back to Lax.
	requestBase := oauthRequestBaseURL(r)
	if clientOrigin != "" {
		if !sameSiteOrigin(clientOrigin, requestBase) {
			if secure {
				return http.SameSiteNoneMode, true
			}
			return http.SameSiteLaxMode, false
		}
	}
	if clientReferer != "" {
		if !sameSiteOrigin(clientReferer, requestBase) {
			if secure {
				return http.SameSiteNoneMode, true
			}
			return http.SameSiteLaxMode, false
		}
	}

	return http.SameSiteLaxMode, secure
}

func sameSiteOrigin(left, right string) bool {
	leftURL, leftErr := url.Parse(left)
	rightURL, rightErr := url.Parse(right)
	if leftErr != nil || rightErr != nil {
		return false
	}
	// Same-site should not fail just because frontend/backend use different ports.
	return strings.EqualFold(leftURL.Scheme, rightURL.Scheme) && strings.EqualFold(leftURL.Hostname(), rightURL.Hostname())
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

func oauthCallbackURL(r *http.Request, cfg *config.Config, provider string) string {
	switch provider {
	case "google":
		if redirect := strings.TrimSpace(cfg.GOOGLE_OAUTH_REDIRECT_URL); redirect != "" {
			return redirect
		}
	case "twitter":
		if redirect := strings.TrimSpace(cfg.TWITTER_OAUTH_REDIRECT_URL); redirect != "" {
			return redirect
		}
	}

	return oauthRequestBaseURL(r) + "/api/auth/oauth/" + provider + "/callback"
}

func oauthRequestBaseURL(r *http.Request) string {
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}

	if forwardedProto := strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")); forwardedProto != "" {
		scheme = forwardedProto
	}

	host := strings.TrimSpace(r.Host)
	if host == "" {
		host = strings.TrimSpace(r.Header.Get("X-Forwarded-Host"))
	}

	return scheme + "://" + host
}
