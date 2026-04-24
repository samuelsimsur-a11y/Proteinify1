# Stage B Roadmap (Approval Required)

This roadmap captures deeper improvements after Stage A quick hardening ships.

## B1 Shared Resilient Transport

- Extract a single client transport utility used by:
  - `src/lib/proteinify/clientGenerate.ts`
  - `src/lib/import/clientImport.ts`
- Shared concerns:
  - timeout budget
  - retry/backoff policy
  - fallback endpoint sequencing
  - offline detection
  - normalized error shape (`code`, `message`, `endpoint`)

## B2 Structured Observability

- Introduce request correlation IDs end-to-end.
- Standardize server log schema:
  - `requestId`, `route`, `status`, `latencyMs`, `errorCode`, `endpointUsed`
- Keep `/api/health` as operational baseline and extend with:
  - dependency checks (LLM provider reachability)
  - runtime mode (`serverful` vs `static-export`)

## B3 Feedback-to-Fix Loop

- Current scaffold route: `src/app/api/feedback/route.ts`.
- Next step: persist feedback events to storage and link to incident traces:
  - `requestId`
  - app version / build id
  - mode, source, and endpoint path
  - optional user category and rating

## B4 Data Safety and Migrations

- Replace `any[]` persistence shapes in `src/lib/recipeLog.ts` with runtime schema validation.
- Add storage versioning + migrations for future-safe local/native state.

## Suggested Delivery

1. B1 transport extraction
2. B2 logs + health enrichment
3. B3 persistence-backed feedback ingest
4. B4 schema migration safety
