package services

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"curriculumOs/config"
	"curriculumOs/db/models"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const localAuthProvider = "local"

type RegisterInput struct {
	FirstName string
	LastName  string
	Email     string
	Password  string
}

type LoginInput struct {
	Email    string
	Password string
}

func RegisterLocalUser(db *gorm.DB, input RegisterInput) (*models.User, error) {
	email := strings.TrimSpace(strings.ToLower(input.Email))
	password := strings.TrimSpace(input.Password)
	if email == "" || password == "" {
		return nil, errors.New("email and password are required")
	}

	var existingUser models.User
	err := db.Where("email = ?", email).First(&existingUser).Error
	if err == nil {
		return nil, errors.New("user already exists")
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user := &models.User{
		FirstName:    strings.TrimSpace(input.FirstName),
		LastName:     strings.TrimSpace(input.LastName),
		Email:        email,
		Password:     string(hashedPassword),
		AuthProvider: localAuthProvider,
	}

	if err := db.Create(user).Error; err != nil {
		return nil, err
	}

	return user, nil
}

func AuthenticateLocalUser(db *gorm.DB, input LoginInput) (*models.User, error) {
	email := strings.TrimSpace(strings.ToLower(input.Email))
	password := strings.TrimSpace(input.Password)
	if email == "" || password == "" {
		return nil, errors.New("email and password are required")
	}

	var user models.User
	if err := db.Where("email = ?", email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("invalid email or password")
		}
		return nil, err
	}

	if user.Password == "" {
		return nil, errors.New("account does not support password login")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		return nil, errors.New("invalid email or password")
	}

	return &user, nil
}

func UpsertOAuthUser(db *gorm.DB, profile OAuthUserProfile) (*models.User, error) {
	if profile.Provider == "" || profile.ProviderUserID == "" {
		return nil, errors.New("provider metadata is required")
	}

	var user models.User
	query := db.Where("auth_provider = ? AND provider_account_id = ?", profile.Provider, profile.ProviderUserID)
	if profile.Email != "" {
		query = query.Or("email = ?", profile.Email)
	}

	err := query.First(&user).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	user.FirstName = firstNonEmpty(profile.FirstName, user.FirstName)
	user.LastName = firstNonEmpty(profile.LastName, user.LastName)
	user.Email = firstNonEmpty(profile.Email, user.Email)
	user.ProviderAccountID = profile.ProviderUserID
	user.AuthProvider = profile.Provider
	user.OAUTH_access_token = profile.AccessToken
	user.OAUTH_refresh_token = profile.RefreshToken

	if errors.Is(err, gorm.ErrRecordNotFound) {
		if createErr := db.Create(&user).Error; createErr != nil {
			return nil, createErr
		}

		return &user, nil
	}

	if saveErr := db.Save(&user).Error; saveErr != nil {
		return nil, saveErr
	}

	return &user, nil
}

func IssueAuthToken(cfg *config.Config, user *models.User) (string, error) {
	if cfg.JWT_SECRET == "" {
		return "", errors.New("jwt secret is not configured")
	}

	header, err := encodeJWTPart(map[string]string{
		"alg": "HS256",
		"typ": "JWT",
	})
	if err != nil {
		return "", err
	}

	now := time.Now()
	sessionID, err := newSessionID()
	if err != nil {
		return "", err
	}
	expiresAt := now.Add(7 * 24 * time.Hour).Unix()
	payload, err := encodeJWTPart(map[string]any{
		"sub":      strconv.FormatUint(uint64(user.ID), 10),
		"email":    user.Email,
		"provider": user.AuthProvider,
		"session_id": sessionID,
		"session_expires_at": expiresAt,
		"iat":      now.Unix(),
		"exp":      expiresAt,
	})
	if err != nil {
		return "", err
	}

	unsignedToken := header + "." + payload
	signature := signJWT(cfg.JWT_SECRET, unsignedToken)

	return unsignedToken + "." + signature, nil
}

func newSessionID() (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func ParseAuthToken(cfg *config.Config, token string) (map[string]any, error) {
	if cfg.JWT_SECRET == "" {
		return nil, errors.New("jwt secret is not configured")
	}

	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, errors.New("invalid token format")
	}

	unsignedToken := parts[0] + "." + parts[1]
	if signJWT(cfg.JWT_SECRET, unsignedToken) != parts[2] {
		return nil, errors.New("invalid token signature")
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, err
	}

	var claims map[string]any
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, err
	}

	exp, ok := claims["exp"].(float64)
	if !ok {
		return nil, errors.New("invalid token expiration")
	}
	if int64(exp) < time.Now().Unix() {
		return nil, errors.New("token has expired")
	}

	return claims, nil
}

func FindUserByID(db *gorm.DB, userID uint) (*models.User, error) {
	var user models.User
	if err := db.First(&user, userID).Error; err != nil {
		return nil, err
	}

	return &user, nil
}

func encodeJWTPart(value any) (string, error) {
	raw, err := json.Marshal(value)
	if err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func signJWT(secret string, payload string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}

	return ""
}
