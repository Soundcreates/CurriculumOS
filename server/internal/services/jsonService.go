package services

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
)

func WriteJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Fatal("Error encoding response: ", err)
	}
}

func Normalize_response(res *http.Response) (map[string]any,error) {

	res_data, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}

	var res_payload map[string]any

	if err := json.Unmarshal(res_data, &res_payload) ; err != nil {
		return  nil, err
	}

	return res_payload, nil

}