package handlers

import (
	"curriculumOs/internal/services"
	"fmt"
	"net/http"
)

func (h *Handler) CreatePath(w http.ResponseWriter, r *http.Request) {
	baseUrl := h.cfg.PYTHON_URL + "/upload/source-upload"

	if r.Method != http.MethodPost {
		services.WriteJSON(w, http.StatusMethodNotAllowed, map[string]string{
			"error": "method not allowed",
		})
		return
	}

	pythonReq, err := http.NewRequest(http.MethodPost, baseUrl, r.Body)
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

	python_res, err := client.Do(pythonReq)
	if err != nil {
		services.WriteJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Bad request!",
		})
		return
	}
	defer python_res.Body.Close()
	pythonPayload, err := services.Normalize_response(python_res)
	if err != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Error normalizing the response: %s", err),
		})
		return
	}

	success, _ := pythonPayload["success"].(bool)
	if success {
		services.WriteJSON(w, http.StatusOK, map[string]string{
			"message": "path created successfully",
		})
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
