package handlers

import (
	"bytes"
	"curriculumOs/db/models"
	"curriculumOs/internal/services"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"
)

func (h *Handler) CreatePath(w http.ResponseWriter, r *http.Request) {
	baseUrl := h.cfg.PYTHON_URL + "/upload/source-upload"
	var user *models.User

	if r.Method != http.MethodPost {
		services.WriteJSON(w, http.StatusMethodNotAllowed, map[string]string{
			"error": "method not allowed",
		})
		return
	}

	if h.db != nil {
		var err error
		user, err = h.currentUserFromRequest(r)
		if err != nil {
			services.WriteJSON(w, http.StatusUnauthorized, map[string]string{
				"error": "unauthorized",
			})
			return
		}
	}

	requestBody, err := io.ReadAll(r.Body)
	if err != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "failed to read request body",
		})
		return
	}

	userGoal, timeQuery, parseErr := extractRoadmapRequestFields(r.Header.Get("Content-Type"), requestBody)
	if parseErr != nil {
		services.WriteJSON(w, http.StatusBadRequest, map[string]string{
			"error": fmt.Sprintf("failed to parse roadmap request fields: %s", parseErr),
		})
		return
	}

	pythonReq, err := http.NewRequest(http.MethodPost, baseUrl, bytes.NewReader(requestBody))
	if err != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "failed to prepare python request",
		})
		return
	}

	if contentType := r.Header.Get("Content-Type"); contentType != "" {
		pythonReq.Header.Set("Content-Type", contentType)
	}

	client := &http.Client{}

	pythonRes, err := client.Do(pythonReq)
	if err != nil {
		services.WriteJSON(w, http.StatusBadGateway, map[string]string{
			"error": fmt.Sprintf("failed to reach python service: %s", err),
		})
		return
	}
	defer pythonRes.Body.Close()
	pythonPayload, err := services.Normalize_response(pythonRes)
	if err != nil {
		services.WriteJSON(w, http.StatusBadGateway, map[string]string{
			"error": fmt.Sprintf("Error normalizing the response: %s", err),
		})
		return
	}

	success, _ := pythonPayload["success"].(bool)
	if success {
		responseBody := map[string]any{
			"success":         true,
			"message":         "path created successfully",
			"python_response": pythonPayload,
		}

		if h.db != nil {
			responsePayload, err := json.Marshal(pythonPayload)
			if err != nil {
				services.WriteJSON(w, http.StatusInternalServerError, map[string]string{
					"error": fmt.Sprintf("failed to serialize roadmap response: %s", err),
				})
				return
			}

			roadmapContent := stringifyValue(pythonPayload["roadmap"])
			processedTypes := strings.Join(extractStringSlice(pythonPayload["processed_types"]), ",")
			documentsCount := extractInt(pythonPayload["documents_count"])

			roadmapRecord := models.Roadmap{
				Name:            userGoal,
				Description:     fmt.Sprintf("Roadmap for %s", timeQuery),
				UserGoal:        userGoal,
				TimeQuery:       timeQuery,
				ProcessedTypes:  processedTypes,
				DocumentsCount:  documentsCount,
				RoadmapContent:  roadmapContent,
				ResponsePayload: string(responsePayload),
				AuthorID:        user.ID,
			}

			if err := h.db.Create(&roadmapRecord).Error; err != nil {
				services.WriteJSON(w, http.StatusInternalServerError, map[string]string{
					"error": fmt.Sprintf("failed to save roadmap: %s", err),
				})
				return
			}

			responseBody["roadmap_id"] = roadmapRecord.ID
		}

		services.WriteJSON(w, http.StatusOK, responseBody)
		return
	}

	errMessage, _ := pythonPayload["message"].(string)
	if errMessage == "" {
		errMessage = "failed to process uploaded sources"
	}
	statusCode := pythonRes.StatusCode
	if statusCode < 400 {
		statusCode = http.StatusBadGateway
	}
	services.WriteJSON(w, statusCode, map[string]string{
		"error": errMessage,
	})
}

func extractRoadmapRequestFields(contentType string, body []byte) (string, string, error) {
	mediaType, params, err := mime.ParseMediaType(contentType)
	if err != nil {
		return "", "", err
	}
	if mediaType != "multipart/form-data" {
		return "", "", fmt.Errorf("unexpected content type: %s", mediaType)
	}

	reader := multipart.NewReader(bytes.NewReader(body), params["boundary"])
	form, err := reader.ReadForm(32 << 20)
	if err != nil {
		return "", "", err
	}
	defer form.RemoveAll()

	userGoal := firstFormValue(form.Value["user_goal"])
	timeQuery := firstFormValue(form.Value["time_query"])

	return userGoal, timeQuery, nil
}

func firstFormValue(values []string) string {
	if len(values) == 0 {
		return ""
	}

	return values[0]
}

func stringifyValue(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case []byte:
		return string(typed)
	default:
		serialized, err := json.Marshal(typed)
		if err != nil {
			return fmt.Sprint(typed)
		}
		return string(serialized)
	}
}

func extractStringSlice(value any) []string {
	switch typed := value.(type) {
	case []string:
		return typed
	case []any:
		result := make([]string, 0, len(typed))
		for _, item := range typed {
			if text, ok := item.(string); ok {
				result = append(result, text)
			}
		}
		return result
	default:
		return nil
	}
}

func (h *Handler) GetPaths(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		services.WriteJSON(w, http.StatusMethodNotAllowed, map[string]string{
			"error": "method not allowed",
		})
		return
	}

	user, err := h.currentUserFromRequest(r)
	if err != nil {
		services.WriteJSON(w, http.StatusUnauthorized, map[string]string{
			"error": "unauthorized",
		})
		return
	}

	var roadmaps []models.Roadmap
	if err := h.db.Where("author_id= ?", user.ID).Find(&roadmaps).Error; err != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("failed to retrieve roadmaps: %s", err),
		})
		return
	}

	services.WriteJSON(w, http.StatusOK, map[string]any{
		"success":  true,
		"roadmaps": roadmaps,
	})
}

type dayProgressEntry struct {
	DayLabel  string `json:"dayLabel"`
	Completed bool   `json:"completed"`
}

func parseDayProgress(raw string) []dayProgressEntry {
	if strings.TrimSpace(raw) == "" {
		return []dayProgressEntry{}
	}

	var result []dayProgressEntry
	if err := json.Unmarshal([]byte(raw), &result); err != nil {
		return []dayProgressEntry{}
	}

	return result
}

func (h *Handler) UpdateDayProgress(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		services.WriteJSON(w, http.StatusMethodNotAllowed, map[string]string{
			"error": "method not allowed",
		})
		return
	}

	user, err := h.currentUserFromRequest(r)
	if err != nil {
		services.WriteJSON(w, http.StatusUnauthorized, map[string]string{
			"error": "unauthorized",
		})
		return
	}

	var payload struct {
		RoadmapID uint   `json:"roadmapId"`
		DayLabel  string `json:"dayLabel"`
		Completed bool   `json:"completed"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		services.WriteJSON(w, http.StatusBadRequest, map[string]string{
			"error": "invalid request body",
		})
		return
	}

	if payload.RoadmapID == 0 || strings.TrimSpace(payload.DayLabel) == "" {
		services.WriteJSON(w, http.StatusBadRequest, map[string]string{
			"error": "roadmapId and dayLabel are required",
		})
		return
	}

	var roadmap models.Roadmap
	if err := h.db.Where("id = ? AND author_id = ?", payload.RoadmapID, user.ID).First(&roadmap).Error; err != nil {
		services.WriteJSON(w, http.StatusNotFound, map[string]string{
			"error": "roadmap not found",
		})
		return
	}

	progress := parseDayProgress(roadmap.DayProgress)
	updated := false
	for i := range progress {
		if strings.EqualFold(progress[i].DayLabel, payload.DayLabel) {
			progress[i].Completed = payload.Completed
			updated = true
			break
		}
	}
	if !updated {
		progress = append(progress, dayProgressEntry{
			DayLabel:  payload.DayLabel,
			Completed: payload.Completed,
		})
	}

	serialized, err := json.Marshal(progress)
	if err != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "failed to serialize day progress",
		})
		return
	}

	roadmap.DayProgress = string(serialized)
	if err := h.db.Save(&roadmap).Error; err != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "failed to save day progress",
		})
		return
	}

	services.WriteJSON(w, http.StatusOK, map[string]any{
		"success":     true,
		"dayProgress": progress,
	})
}

func (h *Handler) GenerateQuiz(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		services.WriteJSON(w, http.StatusMethodNotAllowed, map[string]string{
			"error": "method not allowed",
		})
		return
	}

	user, err := h.currentUserFromRequest(r)
	if err != nil {
		services.WriteJSON(w, http.StatusUnauthorized, map[string]string{
			"error": "unauthorized",
		})
		return
	}

	var payload struct {
		RoadmapID        uint `json:"roadmapId"`
		DifficultyTiers  int  `json:"difficultyTiers"`
		QuestionsPerTier int  `json:"questionsPerTier"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		services.WriteJSON(w, http.StatusBadRequest, map[string]string{
			"error": "invalid request body",
		})
		return
	}
	if payload.RoadmapID == 0 {
		services.WriteJSON(w, http.StatusBadRequest, map[string]string{
			"error": "roadmapId is required",
		})
		return
	}
	if payload.DifficultyTiers < 1 || payload.DifficultyTiers > 4 {
		services.WriteJSON(w, http.StatusBadRequest, map[string]string{
			"error": "difficultyTiers must be between 1 and 4",
		})
		return
	}
	if payload.QuestionsPerTier != 6 && payload.QuestionsPerTier != 10 && payload.QuestionsPerTier != 15 {
		services.WriteJSON(w, http.StatusBadRequest, map[string]string{
			"error": "questionsPerTier must be one of 6, 10, 15",
		})
		return
	}

	var roadmap models.Roadmap
	if err := h.db.Where("id = ? AND author_id = ?", payload.RoadmapID, user.ID).First(&roadmap).Error; err != nil {
		services.WriteJSON(w, http.StatusNotFound, map[string]string{
			"error": "roadmap not found",
		})
		return
	}

	pythonPayload, err := json.Marshal(map[string]any{
		"roadmap_content":    roadmap.RoadmapContent,
		"user_goal":          roadmap.UserGoal,
		"time_query":         roadmap.TimeQuery,
		"processed_types":    roadmap.ProcessedTypes,
		"documents_count":    roadmap.DocumentsCount,
		"difficulty_tiers":   payload.DifficultyTiers,
		"questions_per_tier": payload.QuestionsPerTier,
	})
	if err != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "failed to prepare quiz request",
		})
		return
	}

	pythonReq, err := http.NewRequest(
		http.MethodPost,
		h.cfg.PYTHON_URL+"/quiz/generate",
		bytes.NewReader(pythonPayload),
	)
	if err != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "failed to build quiz request",
		})
		return
	}
	pythonReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	pythonRes, err := client.Do(pythonReq)
	if err != nil {
		services.WriteJSON(w, http.StatusBadGateway, map[string]string{
			"error": "failed to reach quiz service",
		})
		return
	}
	defer pythonRes.Body.Close()

	normalized, err := services.Normalize_response(pythonRes)
	if err != nil {
		services.WriteJSON(w, http.StatusBadGateway, map[string]string{
			"error": "invalid quiz service response",
		})
		return
	}

	services.WriteJSON(w, pythonRes.StatusCode, normalized)
}

func extractInt(value any) int {
	switch typed := value.(type) {
	case int:
		return typed
	case int32:
		return int(typed)
	case int64:
		return int(typed)
	case float64:
		return int(typed)
	case json.Number:
		parsed, err := strconv.Atoi(typed.String())
		if err != nil {
			return 0
		}
		return parsed
	default:
		return 0
	}
}
