package handlers

import (
	"curriculumOs/db/models"
	"curriculumOs/internal/services"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"gorm.io/gorm"
)

var validCompletionStatuses = map[string]bool{
	"not_started": true,
	"in_progress": true,
	"completed":   true,
	"stopped":     true,
}

type roadmapFeedbackPayload struct {
	RoadmapID            uint   `json:"roadmapId"`
	CitationRating       int    `json:"citationRating"`
	TaskUsefulnessRating int    `json:"taskUsefulnessRating"`
	CompletionStatus     string `json:"completionStatus"`
	Comment              string `json:"comment"`
}

func parseRoadmapID(raw string) (uint, error) {
	value, err := strconv.ParseUint(strings.TrimSpace(raw), 10, 32)
	return uint(value), err
}

func roadmapCompletionPercent(roadmap models.Roadmap) int {
	totalDays := parseTotalDaysFromContent(roadmap.RoadmapContent)
	if totalDays == 0 {
		return 0
	}
	percent := parseCompletedDaysCount(roadmap.DayProgress) * 100 / totalDays
	if percent > 100 {
		return 100
	}
	return percent
}

func publicRoadmapFeedback(feedback models.RoadmapFeedback) map[string]any {
	return map[string]any{
		"id":                   feedback.ID,
		"roadmapId":            feedback.RoadmapID,
		"citationRating":       feedback.CitationRating,
		"taskUsefulnessRating": feedback.TaskUsefulnessRating,
		"completionStatus":     feedback.CompletionStatus,
		"completionPercent":    feedback.CompletionPercent,
		"comment":              feedback.Comment,
		"createdAt":            feedback.CreatedAt,
		"updatedAt":            feedback.UpdatedAt,
	}
}

func (h *Handler) GetRoadmapFeedback(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		services.WriteJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	user, err := h.currentUserFromRequest(r)
	if err != nil {
		services.WriteJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	roadmapID, err := parseRoadmapID(r.URL.Query().Get("roadmapId"))
	if err != nil {
		services.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "roadmapId is required"})
		return
	}
	var roadmap models.Roadmap
	if err := h.db.Where("id = ? AND author_id = ?", roadmapID, user.ID).First(&roadmap).Error; err != nil {
		services.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "roadmap not found"})
		return
	}
	var feedback models.RoadmapFeedback
	if err := h.db.Where("roadmap_id = ? AND author_id = ?", roadmapID, user.ID).First(&feedback).Error; errors.Is(err, gorm.ErrRecordNotFound) {
		services.WriteJSON(w, http.StatusOK, map[string]any{"success": true, "feedback": nil})
		return
	} else if err != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to retrieve feedback"})
		return
	}
	services.WriteJSON(w, http.StatusOK, map[string]any{"success": true, "feedback": publicRoadmapFeedback(feedback)})
}

func (h *Handler) SaveRoadmapFeedback(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut && r.Method != http.MethodPost {
		services.WriteJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	user, err := h.currentUserFromRequest(r)
	if err != nil {
		services.WriteJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	var payload roadmapFeedbackPayload
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&payload); err != nil {
		services.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid feedback body"})
		return
	}
	if payload.RoadmapID == 0 || payload.CitationRating < 1 || payload.CitationRating > 5 || payload.TaskUsefulnessRating < 1 || payload.TaskUsefulnessRating > 5 {
		services.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "roadmapId and ratings from 1 to 5 are required"})
		return
	}
	payload.CompletionStatus = strings.ToLower(strings.TrimSpace(payload.CompletionStatus))
	if !validCompletionStatuses[payload.CompletionStatus] {
		services.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "completionStatus is invalid"})
		return
	}
	if len(payload.Comment) > 2_000 {
		services.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "comment must be at most 2000 characters"})
		return
	}
	var roadmap models.Roadmap
	if err := h.db.Where("id = ? AND author_id = ?", payload.RoadmapID, user.ID).First(&roadmap).Error; err != nil {
		services.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "roadmap not found"})
		return
	}
	completionPercent := roadmapCompletionPercent(roadmap)
	var feedback models.RoadmapFeedback
	result := h.db.Where("roadmap_id = ? AND author_id = ?", payload.RoadmapID, user.ID).First(&feedback)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		feedback = models.RoadmapFeedback{RoadmapID: payload.RoadmapID, AuthorID: user.ID}
	} else if result.Error != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to retrieve feedback"})
		return
	}
	feedback.CitationRating = payload.CitationRating
	feedback.TaskUsefulnessRating = payload.TaskUsefulnessRating
	feedback.CompletionStatus = payload.CompletionStatus
	feedback.CompletionPercent = completionPercent
	feedback.Comment = strings.TrimSpace(payload.Comment)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		if err := h.db.Create(&feedback).Error; err != nil {
			services.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to save feedback"})
			return
		}
	} else if err := h.db.Save(&feedback).Error; err != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to save feedback"})
		return
	}
	services.WriteJSON(w, http.StatusOK, map[string]any{"success": true, "feedback": publicRoadmapFeedback(feedback)})
}
