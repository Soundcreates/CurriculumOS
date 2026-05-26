package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// clear-db.go
//
// Clears the entire Postgres database by dropping and recreating the "public" schema.
//
// Safety:
// - Requires CONFIRM_CLEAR_DB=YES to run.
// - Uses DATABASE_URL for the connection string.
//
// Usage:
//   cd server
//   CONFIRM_CLEAR_DB=YES DATABASE_URL='postgres://...' go run clear-db.go
func main() {
	confirm := os.Getenv("CONFIRM_CLEAR_DB")
	if confirm != "YES" {
		log.Fatal("Refusing to run. Set CONFIRM_CLEAR_DB=YES to clear the database.")
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is required.")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	db, err := sql.Open("pgx", dsn)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer db.Close()

	if err := db.PingContext(ctx); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Drop and recreate the public schema. This wipes tables, types, sequences, views, functions, etc.
	// Using a single Exec keeps it simple and transactional semantics are handled by Postgres.
	stmt := `
DO $$
BEGIN
  EXECUTE 'DROP SCHEMA IF EXISTS public CASCADE';
  EXECUTE 'CREATE SCHEMA public';
  EXECUTE 'GRANT ALL ON SCHEMA public TO public';
  EXECUTE 'GRANT ALL ON SCHEMA public TO CURRENT_USER';
END $$;
`

	if _, err := db.ExecContext(ctx, stmt); err != nil {
		log.Fatalf("Failed to clear database: %v", err)
	}

	fmt.Println("Database cleared: dropped and recreated schema 'public'.")
}

