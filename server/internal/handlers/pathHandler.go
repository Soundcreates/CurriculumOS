package handlers

import (
	"curriculumOs/internal/services"
	"net/http"
)

func (h *Handler) CreatePath(w http.ResponseWriter, r *http.Request){
	if r.Method!=http.MethodPost {
		services.WriteJSON(w,http.StatusMethodNotAllowed,map[string]string{
			"error": "method not allowed",
		})	
	}


}