# Shipping roadmap

## Phase 1 — private beta hardening

- Configure QStash, OpenAI, Chroma, and the internal service token in staging and production.
- Run the defined source-grounded evaluation set and record creation/worker/LLM latency and cost.
- Invite 100–500 learners only after release gates in the production-readiness audit pass.
- Provide a support/retry path for failed generation jobs and capture feedback on citations, task usefulness, and roadmap completion.

Implemented in the beta flow:

- Failed jobs are listed on the dashboard and can be retried from the persisted job payload; the creation modal also offers a retry when dispatch fails.
- Roadmap detail pages save one editable feedback record per learner/roadmap with citation accuracy, task usefulness, completion status, server-calculated completion percentage, and an optional note.
- Feedback is scoped to the authenticated roadmap owner through `/api/path/feedback` and stored in `roadmap_feedbacks`.

## Phase 2 — retention after quality is proven

- Render source citations and source preview in the roadmap so learners can inspect why a task exists.
- Add goal templates and a short onboarding flow for common learning outcomes.
- Use quiz results to surface weak topics and generate a cited review session, not a new unconstrained curriculum.
- Add reminders/streaks only after users complete enough paths to demonstrate that scheduling is the retention bottleneck.

## Phase 3 — scale only when needed

- Move pending source payloads to private object storage, persist document/source metadata separately, and define source deletion/retention policies.
- Replace AutoMigrate with versioned migrations and normalize roadmap days/tasks/progress when query/reporting needs make JSON blobs limiting.
- Add a retrieval/reranking experiment only if the evaluation set proves the current top-k retrieval misses relevant source passages.
- Consider shared curricula or creator features after source-grounded roadmap activation and completion metrics are healthy; do not build a marketplace before that evidence exists.

## Rollout and rollback

- Deploy database job tables before Go and worker changes.
- Deploy the worker, then configure QStash, then deploy the Go gateway, and finally the client polling UX.
- Roll back the client/gateway together if job creation fails; jobs remain durable for retry.
- Disable queue dispatch and preserve failed jobs if the worker/provider is unavailable. Never route users back to the old synchronous web-scraping path.
