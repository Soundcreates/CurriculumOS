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

	if r.Method != http.MethodPost {
		services.WriteJSON(w, http.StatusMethodNotAllowed, map[string]string{
			"error": "method not allowed",
		})
		return
	}

	requestBody, err := io.ReadAll(r.Body)
	if err != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "failed to read request body",
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
		services.WriteJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Bad request!",
		})
		return
	}
	defer pythonRes.Body.Close()
	pythonPayload, err := services.Normalize_response(pythonRes)
	if err != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{
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
			userGoal, timeQuery, parseErr := extractRoadmapRequestFields(r.Header.Get("Content-Type"), requestBody)
			if parseErr != nil {
				services.WriteJSON(w, http.StatusInternalServerError, map[string]string{
					"error": fmt.Sprintf("failed to parse roadmap request fields: %s", parseErr),
				})
				return
			}

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
	services.WriteJSON(w, http.StatusInternalServerError, map[string]string{
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
