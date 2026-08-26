package handlers

import (
	"context"
	"curriculumOs/db/models"
	"curriculumOs/internal/services"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const maxGenerationFiles = 5

type generationSource struct {
	Name        string `json:"name"`
	Kind        string `json:"kind"`
	ContentType string `json:"content_type,omitempty"`
	Content     string `json:"content,omitempty"`
	URL         string `json:"url,omitempty"`
}

type generationInput struct {
	Sources   []generationSource `json:"sources"`
	UserGoal  string             `json:"user_goal"`
	TimeQuery string             `json:"time_query"`
}

func (h *Handler) CreateGenerationJob(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		services.WriteJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if h.db == nil {
		services.WriteJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "database is unavailable"})
		return
	}
	user, err := h.currentUserFromRequest(r)
	if err != nil {
		services.WriteJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	var recentJobs int64
	if err := h.db.Model(&models.GenerationJob{}).Where("author_id = ? AND created_at > ?", user.ID, time.Now().Add(-time.Hour)).Count(&recentJobs).Error; err != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to check generation quota"})
		return
	}
	if recentJobs >= 5 {
		services.WriteJSON(w, http.StatusTooManyRequests, map[string]string{"error": "generation limit reached; retry in an hour"})
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, h.cfg.MAX_UPLOAD_BYTES)
	if err := r.ParseMultipartForm(h.cfg.MAX_UPLOAD_BYTES); err != nil {
		services.WriteJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "source upload exceeds the configured limit"})
		return
	}
	input, processedTypes, err := parseGenerationInput(r.MultipartForm, h.cfg.MAX_UPLOAD_BYTES)
	if err != nil {
		services.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	payload, err := json.Marshal(input)
	if err != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to prepare generation job"})
		return
	}
	jobID, err := services.NewGenerationJobID()
	if err != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create generation job"})
		return
	}
	job := models.GenerationJob{
		ID:             jobID,
		AuthorID:       user.ID,
		Status:         models.GenerationJobQueued,
		InputPayload:   string(payload),
		UserGoal:       input.UserGoal,
		TimeQuery:      input.TimeQuery,
		ProcessedTypes: strings.Join(processedTypes, ","),
	}
	if err := h.db.Create(&job).Error; err != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to save generation job"})
		return
	}

	if err := services.DispatchGenerationJob(context.Background(), h.cfg, job.ID); err != nil {
		h.db.Model(&job).Updates(map[string]any{"status": models.GenerationJobFailed, "error_message": "generation could not be queued"})
		services.WriteJSON(w, http.StatusServiceUnavailable, map[string]any{"error": "generation could not be queued", "jobId": job.ID})
		return
	}
	services.WriteJSON(w, http.StatusAccepted, publicGenerationJob(job))
}

func parseGenerationInput(form *multipart.Form, maxUploadBytes int64) (generationInput, []string, error) {
	if form == nil {
		return generationInput{}, nil, fmt.Errorf("multipart form is required")
	}
	input := generationInput{
		UserGoal:  strings.TrimSpace(firstFormValue(form.Value["user_goal"])),
		TimeQuery: strings.TrimSpace(firstFormValue(form.Value["time_query"])),
	}
	if input.UserGoal == "" || len(input.UserGoal) > 4_000 {
		return generationInput{}, nil, fmt.Errorf("user_goal is required and must be at most 4000 characters")
	}
	if input.TimeQuery == "" || len(input.TimeQuery) > 128 {
		return generationInput{}, nil, fmt.Errorf("time_query is required and must be at most 128 characters")
	}
	processedTypes := make([]string, 0, 3)
	if text := strings.TrimSpace(firstFormValue(form.Value["text"])); text != "" {
		if len(text) > 100_000 {
			return generationInput{}, nil, fmt.Errorf("text source must be at most 100000 characters")
		}
		input.Sources = append(input.Sources, generationSource{Name: "text", Kind: "text", Content: text})
		processedTypes = append(processedTypes, "text")
	}
	for _, rawURL := range form.Value["url"] {
		if strings.TrimSpace(rawURL) == "" {
			continue
		}
		if err := validateYouTubeURL(rawURL); err != nil {
			return generationInput{}, nil, err
		}
		input.Sources = append(input.Sources, generationSource{Name: "youtube", Kind: "youtube_url", URL: strings.TrimSpace(rawURL)})
		processedTypes = append(processedTypes, "youtube")
	}
	files := form.File["file"]
	if len(files) > maxGenerationFiles {
		return generationInput{}, nil, fmt.Errorf("at most %d files may be uploaded", maxGenerationFiles)
	}
	for _, file := range files {
		source, processedType, err := readGenerationFile(file, maxUploadBytes)
		if err != nil {
			return generationInput{}, nil, err
		}
		input.Sources = append(input.Sources, source)
		processedTypes = append(processedTypes, processedType)
	}
	if len(input.Sources) == 0 {
		return generationInput{}, nil, fmt.Errorf("provide at least one text, YouTube, or supported file source")
	}
	return input, uniqueStrings(processedTypes), nil
}

func readGenerationFile(file *multipart.FileHeader, maxUploadBytes int64) (generationSource, string, error) {
	name := filepath.Base(strings.TrimSpace(file.Filename))
	extension := strings.ToLower(filepath.Ext(name))
	if extension != ".pdf" && extension != ".txt" && extension != ".md" {
		return generationSource{}, "", fmt.Errorf("unsupported file type %q", extension)
	}
	if file.Size > maxUploadBytes {
		return generationSource{}, "", fmt.Errorf("file %q exceeds the configured upload limit", name)
	}
	opened, err := file.Open()
	if err != nil {
		return generationSource{}, "", fmt.Errorf("failed to read %q", name)
	}
	defer opened.Close()
	content, err := io.ReadAll(io.LimitReader(opened, maxUploadBytes+1))
	if err != nil || int64(len(content)) > maxUploadBytes {
		return generationSource{}, "", fmt.Errorf("failed to read %q within the configured limit", name)
	}
	if extension == ".pdf" {
		if len(content) < 5 || string(content[:5]) != "%PDF-" {
			return generationSource{}, "", fmt.Errorf("%q is not a valid PDF", name)
		}
		return generationSource{Name: name, Kind: "pdf", ContentType: "application/pdf", Content: base64.StdEncoding.EncodeToString(content)}, "pdf", nil
	}
	if !utf8Valid(content) {
		return generationSource{}, "", fmt.Errorf("%q must be UTF-8 text", name)
	}
	return generationSource{Name: name, Kind: "text_file", ContentType: "text/plain", Content: string(content)}, "text_file", nil
}

func validateYouTubeURL(rawURL string) error {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || parsed.Scheme != "https" {
		return fmt.Errorf("source URL must be an HTTPS YouTube URL")
	}
	host := strings.ToLower(parsed.Hostname())
	if host != "youtube.com" && host != "www.youtube.com" && host != "m.youtube.com" && host != "youtu.be" {
		return fmt.Errorf("only YouTube source URLs are supported")
	}
	return nil
}

func utf8Valid(value []byte) bool {
	return strings.ToValidUTF8(string(value), "") == string(value)
}

func uniqueStrings(values []string) []string {
	seen := make(map[string]bool, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		if !seen[value] {
			seen[value] = true
			result = append(result, value)
		}
	}
	return result
}

func publicGenerationJob(job models.GenerationJob) map[string]any {
	return map[string]any{
		"success":      true,
		"jobId":        job.ID,
		"status":       job.Status,
		"roadmapId":    job.RoadmapID,
		"createdAt":    job.CreatedAt,
		"updatedAt":    job.UpdatedAt,
		"errorMessage": job.ErrorMessage,
		"userGoal":     job.UserGoal,
	}
}

func (h *Handler) GetGenerationJob(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		services.WriteJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	user, err := h.currentUserFromRequest(r)
	if err != nil {
		services.WriteJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	jobID := strings.TrimPrefix(r.URL.Path, "/generation-jobs/")
	var job models.GenerationJob
	if jobID == "" || h.db.Where("id = ? AND author_id = ?", jobID, user.ID).First(&job).Error != nil {
		services.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "generation job not found"})
		return
	}
	services.WriteJSON(w, http.StatusOK, publicGenerationJob(job))
}

func (h *Handler) ListFailedGenerationJobs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		services.WriteJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	user, err := h.currentUserFromRequest(r)
	if err != nil {
		services.WriteJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	var jobs []models.GenerationJob
	if err := h.db.Where("author_id = ? AND status = ?", user.ID, models.GenerationJobFailed).
		Order("updated_at DESC").Limit(10).Find(&jobs).Error; err != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to retrieve failed generation jobs"})
		return
	}
	result := make([]map[string]any, 0, len(jobs))
	for _, job := range jobs {
		result = append(result, publicGenerationJob(job))
	}
	services.WriteJSON(w, http.StatusOK, map[string]any{"success": true, "jobs": result})
}

func (h *Handler) RetryGenerationJob(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		services.WriteJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	user, err := h.currentUserFromRequest(r)
	if err != nil {
		services.WriteJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	jobID := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/generation-jobs/"), "/retry")
	var job models.GenerationJob
	if jobID == "" || h.db.Where("id = ? AND author_id = ?", jobID, user.ID).First(&job).Error != nil {
		services.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "generation job not found"})
		return
	}
	if job.Status == models.GenerationJobSucceeded {
		services.WriteJSON(w, http.StatusConflict, map[string]string{"error": "generation job already succeeded"})
		return
	}
	job.Status, job.ErrorMessage = models.GenerationJobQueued, ""
	if err := h.db.Save(&job).Error; err != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to retry generation job"})
		return
	}
	if err := services.DispatchGenerationJob(context.Background(), h.cfg, job.ID); err != nil {
		job.Status, job.ErrorMessage = models.GenerationJobFailed, "generation could not be queued"
		h.db.Save(&job)
		services.WriteJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "generation could not be queued"})
		return
	}
	services.WriteJSON(w, http.StatusAccepted, publicGenerationJob(job))
}

func (h *Handler) InternalGenerationJob(w http.ResponseWriter, r *http.Request) {
	if !h.authorizeInternalRequest(r) {
		services.WriteJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/internal/generation-jobs/")
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) != 2 || parts[0] == "" {
		services.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "generation job not found"})
		return
	}
	var job models.GenerationJob
	if h.db.First(&job, "id = ?", parts[0]).Error != nil {
		services.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "generation job not found"})
		return
	}
	switch parts[1] {
	case "start":
		if r.Method != http.MethodPost || job.Status == models.GenerationJobSucceeded {
			services.WriteJSON(w, http.StatusConflict, map[string]string{"error": "generation job is not startable"})
			return
		}
		job.Status, job.ErrorMessage, job.Attempts = models.GenerationJobRunning, "", job.Attempts+1
		if err := h.db.Save(&job).Error; err != nil {
			services.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to start generation job"})
			return
		}
		services.WriteJSON(w, http.StatusOK, map[string]any{"id": job.ID, "author_id": job.AuthorID, "input": json.RawMessage(job.InputPayload)})
	case "complete":
		h.completeGenerationJob(w, r, &job)
	case "fail":
		h.failGenerationJob(w, r, &job)
	default:
		services.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "generation job route not found"})
	}
}

func (h *Handler) completeGenerationJob(w http.ResponseWriter, r *http.Request, job *models.GenerationJob) {
	if r.Method != http.MethodPost {
		services.WriteJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var payload struct {
		Roadmap        json.RawMessage `json:"roadmap"`
		DocumentsCount int             `json:"documents_count"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2<<20)).Decode(&payload); err != nil || len(payload.Roadmap) == 0 || !json.Valid(payload.Roadmap) {
		services.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "valid roadmap JSON is required"})
		return
	}
	if job.Status == models.GenerationJobSucceeded && job.RoadmapID != nil {
		services.WriteJSON(w, http.StatusOK, map[string]any{"success": true, "roadmapId": job.RoadmapID})
		return
	}
	roadmap := models.Roadmap{
		Name:           job.UserGoal,
		Description:    fmt.Sprintf("Roadmap for %s", job.TimeQuery),
		UserGoal:       job.UserGoal,
		TimeQuery:      job.TimeQuery,
		ProcessedTypes: job.ProcessedTypes,
		DocumentsCount: payload.DocumentsCount,
		RoadmapContent: string(payload.Roadmap),
		AuthorID:       job.AuthorID,
	}
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		var lockedJob models.GenerationJob
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&lockedJob, "id = ?", job.ID).Error; err != nil {
			return err
		}
		if lockedJob.Status == models.GenerationJobSucceeded && lockedJob.RoadmapID != nil {
			job.RoadmapID = lockedJob.RoadmapID
			return nil
		}
		if err := tx.Create(&roadmap).Error; err != nil {
			return err
		}
		lockedJob.Status, lockedJob.ErrorMessage, lockedJob.RoadmapID, lockedJob.InputPayload = models.GenerationJobSucceeded, "", &roadmap.ID, ""
		if err := tx.Save(&lockedJob).Error; err != nil {
			return err
		}
		job.Status, job.ErrorMessage, job.RoadmapID = lockedJob.Status, lockedJob.ErrorMessage, lockedJob.RoadmapID
		return nil
	}); err != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to persist roadmap"})
		return
	}
	if job.RoadmapID == nil {
		services.WriteJSON(w, http.StatusConflict, map[string]string{"error": "generation job already completed"})
		return
	}
	services.WriteJSON(w, http.StatusOK, map[string]any{"success": true, "roadmapId": roadmap.ID})
}

func (h *Handler) failGenerationJob(w http.ResponseWriter, r *http.Request, job *models.GenerationJob) {
	if r.Method != http.MethodPost {
		services.WriteJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var payload struct {
		Error string `json:"error"`
	}
	json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&payload)
	job.Status = models.GenerationJobFailed
	job.ErrorMessage = strings.TrimSpace(payload.Error)
	if job.ErrorMessage == "" {
		job.ErrorMessage = "generation failed"
	}
	if err := h.db.Save(job).Error; err != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to update generation job"})
		return
	}
	services.WriteJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) authorizeInternalRequest(r *http.Request) bool {
	if h.cfg.INTERNAL_SERVICE_TOKEN == "" {
		return false
	}
	return r.Header.Get("Authorization") == "Bearer "+h.cfg.INTERNAL_SERVICE_TOKEN
}
