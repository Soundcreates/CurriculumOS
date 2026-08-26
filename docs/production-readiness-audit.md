# Production readiness audit

## Status

The prototype's synchronous generation path has been replaced with durable generation jobs. The Go gateway validates and persists a bounded request, dispatches only a job ID, and the Python worker reports a single source-grounded result back through an authenticated callback.

## Findings addressed

| Risk | Previous behavior | Production behavior |
| --- | --- | --- |
| Request latency | One HTTP request parsed files, indexed content, called multiple LLMs, scraped the web, and saved the result. | `POST /api/path/create` returns `202` with a job ID; the client polls job status. |
| Cross-user retrieval | Every upload entered the shared `paths` collection with no metadata filter. | Chunks have a job/user ID and every retrieval filters by job ID. |
| Index loss | An embedding mismatch deleted the whole collection. | The collection is versioned by name; no request may delete or recreate it. |
| Source fidelity | Search results and scraped pages were blended into the source of truth. | Roadmaps are generated from retrieved upload passages only, with chunk citations. |
| Upload safety | Files were unbounded and PDFs left temporary files behind. | The gateway limits total bytes/files, validates extension/signature/text encoding, and PDF temporary files are removed. |
| Service exposure | Python CORS was wildcard and proxied endpoints had no service authentication. | Explicit CORS origins and a shared internal bearer token protect worker, quiz, and enrichment routes. |
| Model contract | Groq/LangChain output was persisted as loosely handled strings. | The official OpenAI SDK uses strict JSON Schema structured output and Pydantic validation. |

## Remaining beta limits

- Source bytes are stored in PostgreSQL while a job is pending. This is bounded to `MAX_UPLOAD_BYTES` (10 MiB by default). Move originals to private object storage before raising the limit or accepting large/long-lived files.
- The database model is created through GORM AutoMigrate. Introduce reviewed SQL migrations before public launch.
- QStash must be configured in production. Direct worker dispatch is a local-development fallback only.
- Web enrichment remains optional and is not part of roadmap or quiz authority.

## Required operational configuration

- Set `OPENAI_API_KEY`, a pinned `OPENAI_MODEL`, `INTERNAL_SERVICE_TOKEN`, Chroma credentials, `WORKER_URL`, and QStash credentials as platform secrets.
- Do not expose the Python worker publicly without its internal token and queue-signature protection at the edge.
- Track job status counts, job age, worker failure rate, OpenAI latency/errors, Chroma latency, and creation request p95.
- Alert when failed jobs exceed 2% over 15 minutes or queued/running jobs exceed 10 minutes.

## Release gates

1. Go, Python, and client checks pass in CI.
2. A staging job completes with PDF, text, and rejected invalid-file coverage.
3. Retrieval evaluation confirms zero cross-job chunks and every rendered roadmap citation resolves to a stored chunk.
4. Creation endpoint p95 is under one second under beta load; roadmap-completion p95 and cost are recorded from the staging corpus.
