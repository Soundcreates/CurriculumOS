package handlers

import (
	"curriculumOs/db/models"
	"testing"
)

func TestRoadmapCompletionPercent(t *testing.T) {
	roadmap := models.Roadmap{
		RoadmapContent: `{"days":[{"number":1},{"number":2}]}`,
		DayProgress:    `[{"dayLabel":"Day 1","completed":true}]`,
	}
	if got := roadmapCompletionPercent(roadmap); got != 50 {
		t.Fatalf("expected 50%% completion, got %d", got)
	}
}

func TestParseRoadmapIDRejectsInvalidValues(t *testing.T) {
	if _, err := parseRoadmapID("not-a-number"); err == nil {
		t.Fatal("expected invalid roadmap ID to be rejected")
	}
	if id, err := parseRoadmapID("42"); err != nil || id != 42 {
		t.Fatalf("expected roadmap ID 42, got %d (%v)", id, err)
	}
}
