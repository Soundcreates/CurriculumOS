package handlers

import (
	"curriculumOs/db/models"
	"curriculumOs/internal/services"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
)

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{
			"error": "method not allowed",
		})
		return
	}

	var payload struct {
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Email     string `json:"email"`
		Password  string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "invalid request body",
		})
		return
	}

	user, err := services.RegisterLocalUser(h.db, services.RegisterInput{
		FirstName: payload.FirstName,
		LastName:  payload.LastName,
		Email:     payload.Email,
		Password:  payload.Password,
	})
	if err != nil {
		statusCode := http.StatusInternalServerError
		if strings.Contains(err.Error(), "required") || strings.Contains(err.Error(), "exists") {
			statusCode = http.StatusBadRequest
		}

		writeJSON(w, statusCode, map[string]string{
			"error": err.Error(),
		})
		return
	}

	h.finishManualAuth(w, r, user, http.StatusCreated, "account created")
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{
			"error": "method not allowed",
		})
		return
	}

	var payload struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "invalid request body",
		})
		return
	}

	user, err := services.AuthenticateLocalUser(h.db, services.LoginInput{
		Email:    payload.Email,
		Password: payload.Password,
	})
	if err != nil {
		statusCode := http.StatusInternalServerError
		if strings.Contains(err.Error(), "invalid") || strings.Contains(err.Error(), "required") || strings.Contains(err.Error(), "does not support") {
			statusCode = http.StatusUnauthorized
		}

		writeJSON(w, statusCode, map[string]string{
			"error": err.Error(),
		})
		return
	}

	h.finishManualAuth(w, r, user, http.StatusOK, "login successful")
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{
			"error": "method not allowed",
		})
		return
	}

	user, err := h.currentUserFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"error": "unauthorized",
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"user":    safeUser(user),
	})
}

func (h *Handler) ValidateSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{
			"error": "method not allowed",
		})
		return
	}

	user, err := h.currentUserFromRequest(r)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"valid": false,
		})
		return
	}

	token, err := readCookie(r, authTokenCookie)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"valid": false,
		})
		return
	}

	claims, err := services.ParseAuthToken(h.cfg, token)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"valid": false,
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"valid":              true,
		"user":               safeUser(user),
		"sessionId":          claims["session_id"],
		"sessionExpiresAt":   claims["session_expires_at"],
	})
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{
			"error": "method not allowed",
		})
		return
	}

	clearCookie(w, r, authTokenCookie)
	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "logout successful",
	})
}

func (h *Handler) finishManualAuth(w http.ResponseWriter, r *http.Request, user *models.User, statusCode int, message string) {
	token, err := services.IssueAuthToken(h.cfg, user)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "failed to issue auth token",
		})
		return
	}

	setCookie(w, r, authTokenCookie, token)

	writeJSON(w, statusCode, map[string]any{
		"success": true,
		"message": message,
		"token":   token,
		"user":    safeUser(user),
	})
}

func writeJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Fatal("Error encoding response: ", err)
	}
}

func (h *Handler) currentUserFromRequest(r *http.Request) (*models.User, error) {
	token, err := readCookie(r, authTokenCookie)
	if err != nil {
		return nil, err
	}

	claims, err := services.ParseAuthToken(h.cfg, token)
	if err != nil {
		return nil, err
	}

	subject, ok := claims["sub"].(string)
	if !ok {
		return nil, http.ErrNoCookie
	}

	userID, err := strconv.ParseUint(subject, 10, 64)
	if err != nil {
		return nil, err
	}

	return services.FindUserByID(h.db, uint(userID))
}

func safeUser(user *models.User) map[string]any {
	return map[string]any{
		"id":          user.ID,
		"firstName":   user.FirstName,
		"lastName":    user.LastName,
		"email":       user.Email,
		"provider":    user.AuthProvider,
		"hasPassword": user.Password != "",
	}
}
