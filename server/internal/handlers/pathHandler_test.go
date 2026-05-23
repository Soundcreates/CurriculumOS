package handlers_test

import (
	"bytes"
	"curriculumOs/config"
	"curriculumOs/internal/handlers"
	"curriculumOs/internal/routes"
	"encoding/json"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCreatePathMultipartProxyFlow(t *testing.T) {
	defaultTransport := http.DefaultTransport
	http.DefaultTransport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.URL.Path != "/upload/source-upload" {
			t.Fatalf("unexpected python path: %s", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Fatalf("unexpected python method: %s", r.Method)
		}
		mediaType, params, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if err != nil {
			t.Fatalf("invalid content-type: %v", err)
		}
		if mediaType != "multipart/form-data" {
			t.Fatalf("unexpected media type: %s", mediaType)
		}
		mr := multipart.NewReader(r.Body, params["boundary"])
		form, err := mr.ReadForm(10 << 20)
		if err != nil {
			t.Fatalf("failed to parse multipart form: %v", err)
		}
		if got := form.Value["text"][0]; got != "hello world" {
			t.Fatalf("unexpected text field: %s", got)
		}
		if got := form.Value["url"][0]; got != "https://youtube.com/watch?v=abc123" {
			t.Fatalf("unexpected url field: %s", got)
		}
		files := form.File["file"]
		if len(files) != 1 {
			t.Fatalf("unexpected number of files: %d", len(files))
		}
		if files[0].Filename != "notes.txt" {
			t.Fatalf("unexpected filename: %s", files[0].Filename)
		}
		f, err := files[0].Open()
		if err != nil {
			t.Fatalf("failed to open uploaded file: %v", err)
		}
		defer f.Close()
		data, err := io.ReadAll(f)
		if err != nil {
			t.Fatalf("failed to read file: %v", err)
		}
		if string(data) != "file body" {
			t.Fatalf("unexpected file content: %s", string(data))
		}
		body := io.NopCloser(bytes.NewBufferString(`{"success":true,"message":"ok"}`))
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
			Body:       body,
		}, nil
	})
	defer func() {
		http.DefaultTransport = defaultTransport
	}()

	cfg := &config.Config{
		PYTHON_URL: "http://python-service",
	}
	h := handlers.NewHandler(nil, cfg)
	mux := routes.RegisterRoutes(h)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if err := writer.WriteField("text", "hello world"); err != nil {
		t.Fatalf("failed to write text field: %v", err)
	}
	if err := writer.WriteField("url", "https://youtube.com/watch?v=abc123"); err != nil {
		t.Fatalf("failed to write url field: %v", err)
	}
	part, err := writer.CreateFormFile("file", "notes.txt")
	if err != nil {
		t.Fatalf("failed to create file field: %v", err)
	}
	if _, err := part.Write([]byte("file body")); err != nil {
		t.Fatalf("failed to write file body: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("failed to close multipart writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/path/create", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("unexpected status code: %d body: %s", rr.Code, rr.Body.String())
	}

	var payload map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if payload["message"] != "path created successfully" {
		t.Fatalf("unexpected response message: %v", payload["message"])
	}
}

func TestCreatePathReturnsBadRequestWhenPythonUnavailable(t *testing.T) {
	cfg := &config.Config{
		PYTHON_URL: "http://127.0.0.1:1",
	}
	h := handlers.NewHandler(nil, cfg)
	mux := routes.RegisterRoutes(h)

	req := httptest.NewRequest(http.MethodPost, "/api/path/create", bytes.NewBufferString("abc"))
	req.Header.Set("Content-Type", "text/plain")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("unexpected status code: %d body: %s", rr.Code, rr.Body.String())
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}
