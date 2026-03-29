# CurriculumOS

CurriculumOS is a full-stack learning dashboard for managing curated learning paths, signing in with manual auth or OAuth, and visualizing progress through a profile analytics experience.

The project currently includes:
- a Go backend with PostgreSQL, GORM, manual auth, Google OAuth, and X OAuth
- a React + Vite frontend with a custom editorial-style UI
- a profile analytics page built with `recharts`

## Features

- Manual email/password signup and login
- Google OAuth login
- X OAuth 2.0 login
- Cookie-based auth session
- `GET /auth/me` session lookup
- `POST /auth/logout` logout flow
- Dashboard and profile pages
- Profile analytics UI with charts for active paths, completed paths, momentum, and retention
- Air-based hot reload for the Go server

## Tech Stack

### Backend

- Go
- net/http
- GORM
- PostgreSQL
- `golang.org/x/oauth2`
- `bcrypt`

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- Axios
- GSAP
- Lenis
- Recharts

## Project Structure

```text
CurriculumOS/
├── client/                  # React frontend
│   └── src/
│       ├── apis/            # client API calls
│       ├── components/      # reusable UI
│       ├── pages/           # route pages
│       └── service/         # axios base instance
├── server/                  # Go backend
│   ├── cmd/server/          # app entrypoint
│   ├── config/              # env config loading
│   ├── db/                  # DB init and models
│   └── internal/
│       ├── handlers/        # HTTP handlers
│       ├── routes/          # route registration
│       └── services/        # auth and oauth service logic
└── README.md
```

## Current Routes

### Frontend

- `/`
- `/login`
- `/signup`
- `/dashboard`
- `/profile`

### Backend

- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/auth/oauth/google/login`
- `GET /api/auth/oauth/google/callback`
- `GET /api/auth/oauth/twitter/login`
- `GET /api/auth/oauth/twitter/callback`

## Environment Variables

Create `server/.env`.

Required:

```env
PORT=8080
DATABASE_URL=postgres://postgres:password@localhost:5432/curriculumos?sslmode=disable
JWT_SECRET=replace-with-a-long-random-secret

GOOGLE_OAUTH_CLIENT_ID=your-google-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-google-client-secret

TWITTER_OAUTH_CLIENT_ID=your-x-client-id
TWITTER_OAUTH_CLIENT_SECRET=your-x-client-secret
```

Recommended local values:

```env
SERVER_URL=http://127.0.0.1:8080
CLIENT_URL=http://127.0.0.1:5173

GOOGLE_OAUTH_REDIRECT_URL=http://127.0.0.1:8080/api/auth/oauth/google/callback
TWITTER_OAUTH_REDIRECT_URL=http://127.0.0.1:8080/api/auth/oauth/twitter/callback
```

Optional:

```env
STATE=optional-fixed-oauth-state
```

Frontend optional env:

Create `client/.env` if you want to override the API URL.

```env
VITE_API_BASE_URL=http://127.0.0.1:8080/api
```

## OAuth Setup

### Google

Set the Google redirect URI to:

```text
http://127.0.0.1:8080/api/auth/oauth/google/callback
```

### X

Set the X app values to:

- Website URL: `http://127.0.0.1:5173`
- Callback URL: `http://127.0.0.1:8080/api/auth/oauth/twitter/callback`

Notes:
- `TWITTER_OAUTH_BEARER_TOKEN` is not required for user login
- the login flow uses OAuth 2.0 client credentials plus PKCE

## Getting Started

### 1. Install frontend dependencies

```bash
cd client
npm install
```

### 2. Start PostgreSQL

Use any local PostgreSQL instance and make sure `DATABASE_URL` points to it.

### 3. Start the backend

```bash
cd server
go run ./cmd/server
```

### 4. Start the frontend

```bash
cd client
npm run dev
```

Frontend default URL:

```text
http://127.0.0.1:5173
```

Backend default URL:

```text
http://127.0.0.1:8080
```

## Hot Reload

Air is configured for the Go server.

Install Air:

```bash
go install github.com/air-verse/air@latest
```

Run it:

```bash
cd server
air
```

Config file:

- `server/.air.toml`

## Client API Layer

The frontend API layer is organized like this:

- `client/src/service/baseUrl.ts`
  Shared Axios instance with `withCredentials: true`
- `client/src/apis/authApi.ts`
  Auth-related API calls and OAuth redirect helpers

## Auth Flow

### Manual Auth

1. User submits signup or login form
2. Frontend calls `/api/auth/register` or `/api/auth/login`
3. Backend validates credentials
4. Backend issues an auth token and sets the `auth_token` cookie
5. Frontend navigates to `/dashboard`

### OAuth

1. User clicks Google or X button
2. Frontend redirects to backend OAuth start route
3. Backend redirects to provider
4. Provider redirects back to backend callback
5. Backend upserts the user, sets `auth_token`, and redirects to the frontend

## Verification Commands

### Backend

```bash
cd server
GOCACHE=/tmp/go-build go test ./...
```

### Frontend

```bash
cd client
npm run lint
npm run build
```

## Current Limitations

- Profile analytics currently use mocked chart data, while auth/session data is real
- There is no persisted learning-path model yet behind the profile analytics
- The production build currently emits a large JS chunk warning from Vite

## Next Good Steps

- Add database models for learning paths, enrollments, and completion state
- Replace mocked profile analytics with backend-driven data
- Add protected-route handling on the frontend
- Add refresh-safe auth state management
- Add tests for auth handlers and OAuth callbacks
