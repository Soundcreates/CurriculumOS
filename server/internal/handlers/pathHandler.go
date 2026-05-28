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
	"time"
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

// --- Task progress ---

type taskProgressEntry struct {
	DayLabel  string `json:"dayLabel"`
	TaskIndex int    `json:"taskIndex"`
	Completed bool   `json:"completed"`
}

func parseTaskProgress(raw string) []taskProgressEntry {
	if strings.TrimSpace(raw) == "" {
		return []taskProgressEntry{}
	}
	var result []taskProgressEntry
	if err := json.Unmarshal([]byte(raw), &result); err != nil {
		return []taskProgressEntry{}
	}
	return result
}

func (h *Handler) UpdateTaskProgress(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		services.WriteJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	user, err := h.currentUserFromRequest(r)
	if err != nil {
		services.WriteJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var payload struct {
		RoadmapID uint   `json:"roadmapId"`
		DayLabel  string `json:"dayLabel"`
		TaskIndex int    `json:"taskIndex"`
		Completed bool   `json:"completed"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		services.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if payload.RoadmapID == 0 || strings.TrimSpace(payload.DayLabel) == "" {
		services.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "roadmapId and dayLabel are required"})
		return
	}

	var roadmap models.Roadmap
	if err := h.db.Where("id = ? AND author_id = ?", payload.RoadmapID, user.ID).First(&roadmap).Error; err != nil {
		services.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "roadmap not found"})
		return
	}

	progress := parseTaskProgress(roadmap.TaskProgress)
	updated := false
	for i := range progress {
		if strings.EqualFold(progress[i].DayLabel, payload.DayLabel) && progress[i].TaskIndex == payload.TaskIndex {
			progress[i].Completed = payload.Completed
			updated = true
			break
		}
	}
	if !updated {
		progress = append(progress, taskProgressEntry{
			DayLabel:  payload.DayLabel,
			TaskIndex: payload.TaskIndex,
			Completed: payload.Completed,
		})
	}

	serialized, err := json.Marshal(progress)
	if err != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to serialize task progress"})
		return
	}

	roadmap.TaskProgress = string(serialized)
	if err := h.db.Save(&roadmap).Error; err != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to save task progress"})
		return
	}

	services.WriteJSON(w, http.StatusOK, map[string]any{
		"success":      true,
		"taskProgress": progress,
	})
}

// --- Fetch resources (proxy to Python enrich service) ---

func (h *Handler) FetchResources(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		services.WriteJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	_, err := h.currentUserFromRequest(r)
	if err != nil {
		services.WriteJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		services.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "failed to read body"})
		return
	}

	pythonReq, err := http.NewRequest(http.MethodPost, h.cfg.PYTHON_URL+"/enrich/resources", bytes.NewReader(body))
	if err != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to build request"})
		return
	}
	pythonReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(pythonReq)
	if err != nil {
		services.WriteJSON(w, http.StatusBadGateway, map[string]string{"error": "resource service unavailable"})
		return
	}
	defer resp.Body.Close()

	normalized, err := services.Normalize_response(resp)
	if err != nil {
		services.WriteJSON(w, http.StatusBadGateway, map[string]string{"error": "invalid resource service response"})
		return
	}

	services.WriteJSON(w, resp.StatusCode, normalized)
}

// --- Stats types ---

type pathStatsResponse struct {
	TotalPaths      int              `json:"totalPaths"`
	CompletedPaths  int              `json:"completedPaths"`
	InProgressPaths int              `json:"inProgressPaths"`
	QueuedPaths     int              `json:"queuedPaths"`
	CompletionRate  float64          `json:"completionRate"`
	ActivePaths     []activePathStat `json:"activePaths"`
	CompletedList   []completedPath  `json:"completedList"`
	Distribution    []distEntry      `json:"distribution"`
	WeeklyClosures  []weekEntry      `json:"weeklyClosures"`
	MonthlyActivity []monthEntry     `json:"monthlyActivity"`
	CurrentFocus    string           `json:"currentFocus"`
}

type activePathStat struct {
	ID            uint   `json:"id"`
	Name          string `json:"name"`
	Progress      int    `json:"progress"`
	TotalDays     int    `json:"totalDays"`
	CompletedDays int    `json:"completedDays"`
}

type completedPath struct {
	ID        uint      `json:"id"`
	Name      string    `json:"name"`
	TotalDays int       `json:"totalDays"`
	CreatedAt time.Time `json:"createdAt"`
}

type distEntry struct {
	Name  string `json:"name"`
	Value int    `json:"value"`
}

type weekEntry struct {
	Label     string `json:"label"`
	Completed int    `json:"completed"`
	Created   int    `json:"created"`
}

type monthEntry struct {
	Month      string `json:"month"`
	Focus      int    `json:"focus"`
	Completion int    `json:"completion"`
}

// --- Stats helpers ---

func parseTotalDaysFromContent(content string) int {
	if strings.TrimSpace(content) == "" {
		return 0
	}
	var parsed struct {
		Days []json.RawMessage `json:"days"`
	}
	if err := json.Unmarshal([]byte(content), &parsed); err != nil {
		return 0
	}
	return len(parsed.Days)
}

func parseCompletedDaysCount(dayProgress string) int {
	if strings.TrimSpace(dayProgress) == "" {
		return 0
	}
	var entries []struct {
		Completed bool `json:"completed"`
	}
	if err := json.Unmarshal([]byte(dayProgress), &entries); err != nil {
		return 0
	}
	count := 0
	for _, e := range entries {
		if e.Completed {
			count++
		}
	}
	return count
}

// --- GetStats handler ---

func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		services.WriteJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	user, err := h.currentUserFromRequest(r)
	if err != nil {
		services.WriteJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var roadmaps []models.Roadmap
	if err := h.db.Where("author_id = ?", user.ID).Order("created_at DESC").Find(&roadmaps).Error; err != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to retrieve roadmaps"})
		return
	}

	type rmStatus struct {
		total     int
		completed int
		kind      string
	}

	statusMap := make(map[uint]rmStatus, len(roadmaps))
	for _, rm := range roadmaps {
		total := parseTotalDaysFromContent(rm.RoadmapContent)
		done := parseCompletedDaysCount(rm.DayProgress)
		var kind string
		switch {
		case total == 0 || done == 0:
			kind = "queued"
		case done >= total:
			kind = "completed"
		default:
			kind = "in_progress"
		}
		statusMap[rm.ID] = rmStatus{total, done, kind}
	}

	totalPaths := len(roadmaps)
	var completedCount, inProgressCount, queuedCount int
	for _, s := range statusMap {
		switch s.kind {
		case "completed":
			completedCount++
		case "in_progress":
			inProgressCount++
		default:
			queuedCount++
		}
	}

	var completionRate float64
	if totalPaths > 0 {
		completionRate = float64(completedCount) / float64(totalPaths) * 100
	}

	activePaths := make([]activePathStat, 0)
	for _, rm := range roadmaps {
		s := statusMap[rm.ID]
		if s.kind != "in_progress" {
			continue
		}
		progress := 0
		if s.total > 0 {
			progress = s.completed * 100 / s.total
		}
		activePaths = append(activePaths, activePathStat{
			ID:            rm.ID,
			Name:          rm.Name,
			Progress:      progress,
			TotalDays:     s.total,
			CompletedDays: s.completed,
		})
	}

	completedList := make([]completedPath, 0)
	for _, rm := range roadmaps {
		if statusMap[rm.ID].kind != "completed" {
			continue
		}
		completedList = append(completedList, completedPath{
			ID:        rm.ID,
			Name:      rm.Name,
			TotalDays: statusMap[rm.ID].total,
			CreatedAt: rm.CreatedAt,
		})
	}

	distribution := []distEntry{
		{Name: "Active", Value: inProgressCount},
		{Name: "Completed", Value: completedCount},
		{Name: "Queued", Value: queuedCount},
	}

	now := time.Now()
	weeklyClosures := make([]weekEntry, 6)
	for i := 0; i < 6; i++ {
		weekStart := now.AddDate(0, 0, -(6-i)*7)
		weekEnd := now.AddDate(0, 0, -(5-i)*7)
		var created, completed int
		for _, rm := range roadmaps {
			if !rm.CreatedAt.Before(weekStart) && rm.CreatedAt.Before(weekEnd) {
				created++
				if statusMap[rm.ID].kind == "completed" {
					completed++
				}
			}
		}
		weeklyClosures[i] = weekEntry{
			Label:     fmt.Sprintf("W%d", i+1),
			Completed: completed,
			Created:   created,
		}
	}

	monthlyActivity := make([]monthEntry, 6)
	for i := 0; i < 6; i++ {
		t := now.AddDate(0, -(5-i), 0)
		monthKey := t.Format("2006-01")
		var created, completed int
		for _, rm := range roadmaps {
			if rm.CreatedAt.Format("2006-01") == monthKey {
				created++
				if statusMap[rm.ID].kind == "completed" {
					completed++
				}
			}
		}
		monthlyActivity[i] = monthEntry{
			Month:      t.Format("Jan"),
			Focus:      created,
			Completion: completed,
		}
	}

	currentFocus := ""
	for _, rm := range roadmaps {
		if statusMap[rm.ID].kind == "in_progress" {
			currentFocus = rm.Name
			break
		}
	}

	services.WriteJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"stats": pathStatsResponse{
			TotalPaths:      totalPaths,
			CompletedPaths:  completedCount,
			InProgressPaths: inProgressCount,
			QueuedPaths:     queuedCount,
			CompletionRate:  completionRate,
			ActivePaths:     activePaths,
			CompletedList:   completedList,
			Distribution:    distribution,
			WeeklyClosures:  weeklyClosures,
			MonthlyActivity: monthlyActivity,
			CurrentFocus:    currentFocus,
		},
	})
}

func (h *Handler) SubmitQuiz(w http.ResponseWriter, r *http.Request) {
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
		RoadmapID       uint                   `json:"roadmapId"`
		Score           int                    `json:"score"`
		TotalQuestions  int                    `json:"totalQuestions"`
		CorrectAnswers  int                    `json:"correctAnswers"`
		Questions       []map[string]any       `json:"questions"`
		UserAnswers     map[string]string      `json:"userAnswers"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		services.WriteJSON(w, http.StatusBadRequest, map[string]string{
			"error": "invalid request body",
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

	quizDataJSON, err := json.Marshal(payload.Questions)
	if err != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "failed to serialize quiz data",
		})
		return
	}

	userAnswersJSON, err := json.Marshal(payload.UserAnswers)
	if err != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "failed to serialize user answers",
		})
		return
	}

	quizResult := models.QuizResult{
		RoadmapID:      payload.RoadmapID,
		AuthorID:       user.ID,
		Score:          payload.Score,
		TotalQuestions: payload.TotalQuestions,
		CorrectAnswers: payload.CorrectAnswers,
		QuizData:       string(quizDataJSON),
		UserAnswers:    string(userAnswersJSON),
	}

	if err := h.db.Create(&quizResult).Error; err != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("failed to save quiz result: %s", err),
		})
		return
	}

	services.WriteJSON(w, http.StatusCreated, map[string]any{
		"success": true,
		"message": "quiz result saved successfully",
		"result": map[string]any{
			"id":             quizResult.ID,
			"score":          quizResult.Score,
			"correctAnswers": quizResult.CorrectAnswers,
			"totalQuestions": quizResult.TotalQuestions,
			"createdAt":      quizResult.CreatedAt,
		},
	})
}

func (h *Handler) GetQuizResults(w http.ResponseWriter, r *http.Request) {
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

	roadmapIDStr := r.URL.Query().Get("roadmapId")
	if roadmapIDStr == "" {
		services.WriteJSON(w, http.StatusBadRequest, map[string]string{
			"error": "roadmapId query parameter is required",
		})
		return
	}

	roadmapID, err := strconv.ParseUint(roadmapIDStr, 10, 32)
	if err != nil {
		services.WriteJSON(w, http.StatusBadRequest, map[string]string{
			"error": "invalid roadmapId",
		})
		return
	}

	var roadmap models.Roadmap
	if err := h.db.Where("id = ? AND author_id = ?", uint(roadmapID), user.ID).First(&roadmap).Error; err != nil {
		services.WriteJSON(w, http.StatusNotFound, map[string]string{
			"error": "roadmap not found",
		})
		return
	}

	var quizResults []models.QuizResult
	if err := h.db.Where("roadmap_id = ? AND author_id = ?", roadmap.ID, user.ID).
		Order("created_at DESC").
		Find(&quizResults).Error; err != nil {
		services.WriteJSON(w, http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("failed to retrieve quiz results: %s", err),
		})
		return
	}

	results := make([]map[string]any, 0, len(quizResults))
	for _, qr := range quizResults {
		var questions []map[string]any
		if err := json.Unmarshal([]byte(qr.QuizData), &questions); err != nil {
			questions = []map[string]any{}
		}

		var userAnswers map[string]string
		if err := json.Unmarshal([]byte(qr.UserAnswers), &userAnswers); err != nil {
			userAnswers = make(map[string]string)
		}

		results = append(results, map[string]any{
			"id":             qr.ID,
			"roadmapId":      qr.RoadmapID,
			"score":          qr.Score,
			"correctAnswers": qr.CorrectAnswers,
			"totalQuestions": qr.TotalQuestions,
			"questions":      questions,
			"userAnswers":    userAnswers,
			"createdAt":      qr.CreatedAt,
		})
	}

	services.WriteJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"results": results,
	})
}
