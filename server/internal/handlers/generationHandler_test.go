package handlers

import (
	"bytes"
	"mime/multipart"
	"net/http/httptest"
	"testing"
)

func TestParseGenerationInputAcceptsTextAndPDF(t *testing.T) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if err := writer.WriteField("text", "Study Python fundamentals"); err != nil {
		t.Fatal(err)
	}
	if err := writer.WriteField("user_goal", "Build a Python API"); err != nil {
		t.Fatal(err)
	}
	if err := writer.WriteField("time_query", "2 weeks"); err != nil {
		t.Fatal(err)
	}
	part, err := writer.CreateFormFile("file", "syllabus.pdf")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write([]byte("%PDF-1.7\nsource material")); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest("POST", "/path/create", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	if err := req.ParseMultipartForm(1 << 20); err != nil {
		t.Fatal(err)
	}
	input, kinds, err := parseGenerationInput(req.MultipartForm, 1<<20)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(input.Sources) != 2 || input.Sources[1].Kind != "pdf" {
		t.Fatalf("unexpected sources: %#v", input.Sources)
	}
	if input.UserGoal != "Build a Python API" || len(kinds) != 2 {
		t.Fatalf("unexpected parsed input: %#v, %#v", input, kinds)
	}
}

func TestParseGenerationInputRejectsInvalidPDF(t *testing.T) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	writer.WriteField("user_goal", "Learn testing")
	writer.WriteField("time_query", "10 days")
	part, err := writer.CreateFormFile("file", "not-a-pdf.pdf")
	if err != nil {
		t.Fatal(err)
	}
	part.Write([]byte("not a PDF"))
	writer.Close()

	req := httptest.NewRequest("POST", "/path/create", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	if err := req.ParseMultipartForm(1 << 20); err != nil {
		t.Fatal(err)
	}
	if _, _, err := parseGenerationInput(req.MultipartForm, 1<<20); err == nil {
		t.Fatal("expected invalid PDF to be rejected")
	}
}

func TestValidateYouTubeURLRejectsUntrustedHosts(t *testing.T) {
	if err := validateYouTubeURL("https://example.com/watch?v=123"); err == nil {
		t.Fatal("expected non-YouTube URL to be rejected")
	}
	if err := validateYouTubeURL("https://www.youtube.com/watch?v=123"); err != nil {
		t.Fatalf("expected YouTube URL to be accepted: %v", err)
	}
}
