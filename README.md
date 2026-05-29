# CurriculumOS

CurriculumOS is a full-stack AI-powered learning dashboard. It allows users to generate and manage custom, curated learning paths based on their goals and reference materials (files, URLs, YouTube videos). Users can track their progress day-by-day and task-by-day, enrich their understanding with dynamically fetched resources, and test themselves with AI-generated multi-tiered quizzes.

The project is structured as a modern multi-service architecture comprising:
1. **Frontend**: A React 19 + Vite app styling a custom, premium editorial dark UI with Lenis smooth scrolling, GSAP motion transitions, and interactive Recharts analytics.
2. **Backend API Gateway**: A Go HTTP server utilizing GORM and PostgreSQL to handle authentication (manual + OAuth), persistence of roadmaps, day/task progress, and quiz results.
3. **Python RAG Microservice**: A FastAPI service powering the ML/LLM pipeline. It handles document chunking, ChromaDB vector storage, LangChain pipelines, YouTube transcript extraction (with Webshare rotating proxy support), and structured quiz/roadmap generation via the Groq API.

---

## Architecture Diagram

```mermaid
graph TD
    Client[React Frontend] <--> |HTTP / Cookies| GoServer[Go Backend]
    GoServer <--> |PostgreSQL / GORM| DB[(PostgreSQL)]
    GoServer <--> |HTTP / JSON| FastAPI[Python FastAPI Service]
    FastAPI <--> |Vector Indexing| Chroma[(ChromaDB)]
    FastAPI <--> |Structured Generation| Groq[Groq API / LLM]
    FastAPI <--> |Transcripts / Info| YouTube[YouTube API / Webshare Proxies]
```

## Features

- **Personalized Roadmap Generation**: Upload documents (PDF, text) or submit URLs to generate structured, day-by-day study roadmaps targeted to your goals and timeline.
- **Progress Tracking**: Keep track of learning milestones with day-level and task-level status check-offs.
- **Resource Enrichment**: Fetch conceptual resources, additional reading, and matching YouTube video links dynamically for any concept in your path.
- **Multi-Tiered Quizzes**: Assess your understanding with interactive quizzes featuring multiple difficulty tiers. Review results with explanations of correct and incorrect answers.
- **Rich Analytics Dashboard**: Profile page displaying real-time analytics including path distribution, weekly completions, active path progress, and historical quiz stats.
- **Secure Authentication**:
  - Cookie-based session authentication with JWT.
  - Manual Email/Password registration and login.
  - OAuth 2.0 integrations with Google and X (Twitter) using PKCE.

---

## Tech Stack

### Frontend
- **React 19** & **TypeScript**
- **Vite** (Bundler)
- **Tailwind CSS v4** (Styling)
- **Axios** (API Client)
- **GSAP** (Premium Micro-animations and transitions)
- **Lenis** (Smooth Scroll)
- **Recharts** (Visual Analytics & Progress Charts)

### Backend API Gateway (Go)
- **Go** (Language)
- **net/http** (HTTP router)
- **GORM** (ORM)
- **PostgreSQL** (Database)
- **golang.org/x/oauth2** (OAuth Clients)
- **Bcrypt** (Password Hashing)

### RAG & ML Microservice (Python)
- **FastAPI** (Web Framework)
- **LangChain** (RAG Orchestration)
- **Groq SDK** (Structured LLM Generation)
- **ChromaDB** (Vector Database)
- **YouTube Transcript API** (Transcripts Extraction with proxy rotation)
- **PyTube** (YouTube Playlist/Video metadata)

---

## Project Structure

```text
CurriculumOS/
├── client/                     # React Frontend
│   ├── src/
│   │   ├── apis/               # Axios API wrappers (auth, paths, etc.)
│   │   ├── components/         # Reusable UI elements (Modals, Dividers, etc.)
│   │   ├── pages/              # Routed views (Dashboard, SpecificPathView, Profile)
│   │   └── service/            # Base Axios instance with credentials
│   └── package.json
│
├── server/                     # Go Backend API Gateway
│   ├── cmd/server/             # Main application entry point
│   ├── config/                 # Environment configuration loading
│   ├── db/                     # DB connection & GORM schema definitions (Roadmaps, QuizResults, Users)
│   └── internal/
│       ├── handlers/           # HTTP handlers & Python proxy logic
│       ├── routes/             # Route registrations
│       └── services/           # Authentication & token helpers
│
└── python/                     # Python RAG & ML Microservice
    ├── app/
    │   ├── rag/                # Embeddings, chunkers, and YouTube loaders
    │   ├── routes/             # FastAPI routers (quiz, enrich, upload)
    │   ├── schemas/            # Pydantic request/response validation schemas
    │   └── app.py              # FastAPI application server entrypoint
    └── requirements.txt
```

---

## Environment Variables

### 1. Go Backend Server (`server/.env`)
Create `server/.env` with the following variables:
```env
PORT=8080
DATABASE_URL=postgres://postgres:password@localhost:5432/curriculumos?sslmode=disable
JWT_SECRET=your-long-random-jwt-signing-key
PYTHON_URL=http://localhost:8000

# OAuth Credentials
GOOGLE_OAUTH_CLIENT_ID=your-google-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-google-client-secret
GOOGLE_OAUTH_REDIRECT_URL=http://127.0.0.1:8080/api/auth/oauth/google/callback

TWITTER_OAUTH_CLIENT_ID=your-x-client-id
TWITTER_OAUTH_CLIENT_SECRET=your-x-client-secret
TWITTER_OAUTH_REDIRECT_URL=http://127.0.0.1:8080/api/auth/oauth/twitter/callback

# Recommended App Settings
SERVER_URL=http://127.0.0.1:8080
CLIENT_URL=http://127.0.0.1:5173
```

### 2. Python RAG Server (`python/app/.env` and `python/.env`)
Create `python/app/.env` with:
```env
PORT=8000
GROQ_API_KEY=your-groq-api-key
CHROMA_HOST=api.trychroma.com
CHROMA_API_KEY=your-chroma-cloud-api-key
CHROMA_TENANT=your-chroma-tenant-id
CHROMA_DATABASE=CurriculumOS

# Webshare Proxy settings (Optional, for YouTube Transcript retrieval)
WEBSHARE_PROXY_USERNAME=your-webshare-username
WEBSHARE_PROXY_PASSWORD=your-webshare-password
```
Create `python/.env` with:
```env
HF_TOKEN=your-huggingface-token
```

### 3. Frontend Client (`client/.env`)
Create `client/.env` to configure the API base URL:
```env
VITE_API_BASE_URL=http://127.0.0.1:8080/api
```

---

## Getting Started

### Prerequisites
- Go 1.21+
- Python 3.10+
- Node.js 18+
- PostgreSQL instance running

### Step 1: Set Up & Run the Go Backend
1. Navigate to the server folder:
   ```bash
   cd server
   ```
2. Initialize database schema & start the server:
   ```bash
   go run ./cmd/server
   ```
   *(Or run using Air for hot-reload: `air`)*

### Step 2: Set Up & Run the Python RAG Service
1. Navigate to the python folder:
   ```bash
   cd python
   ```
2. Create and activate a virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the FastAPI server:
   ```bash
   uvicorn app.app:app --host 0.0.0.0 --port 8000 --reload
   ```

### Step 3: Set Up & Run the React Frontend
1. Navigate to the client folder:
   ```bash
   cd client
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Run the Vite development server:
   ```bash
   npm run dev
   ```

Open your browser to `http://127.0.0.1:5173` to interact with CurriculumOS.

---

## Verification & Tests

### Backend Tests
```bash
cd server
GOCACHE=/tmp/go-build go test ./...
```

### Frontend Linters & Builds
```bash
cd client
npm run lint
npm run build
```
