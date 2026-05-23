package models

type Path struct {
	ID uint `gorm:"primaryKey;autoIncrement"`
	Name string `json:"name"`
	Description string `json:"description"`
	Attatchements  []string `json:"attatchments"` //list of strings because the files and stuff will be stored in cloudinary whereeas other inputs like text and links are already strings
	Planner []DayPlanner `json:"planner"`
	Notes []Notes `json:"notes"` 
	AuthorID uint  `json:"authorId"`
	Author User `json:"author"`
}

type  Notes struct {
	NoteTitle string `json:"noteTitle"`
	NoteDescription string `json:"noteDescription"`
	Timestamp string `json:"timestamp"`
}

type DayPlanner struct {
	dayNo uint `json:"dayNo"`
	Tasks []tasks `json:"tasks"`
	is_completed bool `json:"isCompleted"`
}

type tasks struct{
	TaskName string `json:"taskName"`
	TaskDescription string `json:"taskDescription"`
	TaskAttatchements []string `json:"taskAttatchements"`
	is_completed bool `json:"isCompleted"`
}
