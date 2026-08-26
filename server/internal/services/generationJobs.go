package services

import (
	"bytes"
	"context"
	"crypto/rand"
	"curriculumOs/config"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

var generationDispatchClient = &http.Client{Timeout: 10 * time.Second}

func NewGenerationJobID() (string, error) {
	raw := make([]byte, 16)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	encoded := hex.EncodeToString(raw)
	return fmt.Sprintf("%s-%s-%s-%s-%s", encoded[:8], encoded[8:12], encoded[12:16], encoded[16:20], encoded[20:]), nil
}

// DispatchGenerationJob sends only an opaque job ID. The worker reads the protected
// payload from the gateway, so source content is never placed in a queue message.
func DispatchGenerationJob(ctx context.Context, cfg *config.Config, jobID string) error {
	payload, err := json.Marshal(map[string]string{"job_id": jobID})
	if err != nil {
		return err
	}

	workerURL := strings.TrimRight(cfg.WORKER_URL, "/") + "/worker/generate"
	if cfg.QSTASH_TOKEN == "" {
		return dispatchDirect(ctx, workerURL, cfg.INTERNAL_SERVICE_TOKEN, payload)
	}

	qstashURL := strings.TrimRight(cfg.QSTASH_URL, "/")
	if !strings.HasSuffix(qstashURL, "/v2/publish") {
		qstashURL += "/v2/publish"
	}
	publishURL := qstashURL + "/" + workerURL
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, publishURL, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+cfg.QSTASH_TOKEN)
	req.Header.Set("Content-Type", "application/json")
	if cfg.INTERNAL_SERVICE_TOKEN != "" {
		req.Header.Set("Upstash-Forward-Authorization", "Bearer "+cfg.INTERNAL_SERVICE_TOKEN)
	}

	resp, err := generationDispatchClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("queue rejected generation job: %s", resp.Status)
	}
	return nil
}

func dispatchDirect(ctx context.Context, workerURL, token string, payload []byte) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, workerURL, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := generationDispatchClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("worker rejected generation job: %s", resp.Status)
	}
	return nil
}
