# Deployment Target Decision: Vercel + Render + Supabase

> **Status:** Approved · **Date:** 2026-07-12
> **Supersedes** the AWS-EKS / Kubernetes / Terraform / Prometheus stack described in
> `04-system-architecture.md`, `07-monorepo-structure.md`, `11-environment-and-devops.md`.

## 1. Decision

The Multi-Modal SLM Query Router is built and deployed on a **Vercel + Render + Supabase**
stack rather than the self-managed AWS EKS / K8s / Terraform platform in the original
specs. This document records *why* and gives the precise spec→reality mapping so every
later decision stays consistent.

## 2. Why this stack

| Concern | Self-managed (spec) | Vercel + Render + Supabase (chosen) |
|---|---|---|
| Time-to-live | Weeks of infra setup | Hours — managed platforms |
| ML container hosting | EKS + GPU/CPU node pools + taints | Render web services (Docker) |
| Postgres ops | RDS + backups + scaling | Supabase managed Postgres |
| Auth | Build JWT/OAuth ourselves | Supabase Auth (GoTrue) |
| File storage | MinIO self-hosted | Supabase Storage (S3-compatible) |
| CDN / edge | CloudFront config | Vercel edge network |
| Cost at low scale | Fixed infra spend | Pay-as-you-go, generous free tiers |
| Observability | Prometheus + Grafana + Loki | Platform-native logs + Vercel Analytics |

Trade-off accepted: less granular control over the data plane and a per-request cost
model. For this product's launch stage that is the right trade.

## 3. Spec → reality mapping

| Component in the docs | This build | Where it lives |
|---|---|---|
| API Gateway (Kong / AWS API GW) | Next.js middleware + API routes | **Vercel** (`apps/web`) |
| Gateway Service (Node/NestJS) | Next.js API routes | **Vercel** (`apps/web/app/api`) |
| Input Processor Service | Module inside `orchestrator` | **Render** |
| Response Builder Service | Module inside `orchestrator` | **Render** |
| Worker (Celery) | Background tasks on `orchestrator` + Redis queue | **Render** |
| OCR Service | `ocr-service` (unchanged) | **Render** (Docker: Tesseract/EasyOCR/PaddleOCR) |
| STT Service | `stt-service` (unchanged) | **Render** (Docker: Whisper) + Deepgram client |
| Analysis Engine (SLM) | `analysis-engine` (unchanged) | **Render** (calls OpenRouter) |
| Router Service | `router-service` (unchanged) | **Render** (calls OpenRouter) |
| PostgreSQL | Supabase Postgres | **Supabase** |
| Redis (cache + queue) | Upstash Redis (REST + URL) | **Upstash** |
| MinIO / S3 object storage | Supabase Storage | **Supabase** |
| Pinecone / Milvus vector DB | pgvector extension on Supabase Postgres | **Supabase** |
| Custom JWT auth (Argon2/RS256) | Supabase Auth (GoTrue, JWT) | **Supabase** |
| WebSocket streaming | **SSE** (Server-Sent Events) | Vercel + Render (both support SSE; no persistent WS needed) |
| Rate limiting (gateway) | Upstash-backed middleware | Vercel edge |
| Prometheus metrics | `/metrics` endpoints + platform dashboards | Render + Vercel |
| Grafana / Loki | Render logs + Vercel Analytics | platform |
| EKS / Terraform / K8s manifests | `render.yaml` + `vercel.json` | **Render + Vercel** |
| `make` targets | pnpm scripts in root `package.json` | local |

## 4. Service decomposition on Render

Five FastAPI services, each its own Render web service with a Dockerfile and healthcheck:

```
orchestrator      :8001   input validation, modality detection, flow, response assembly
ocr-service       :8002   OCR engines (Tesseract/EasyOCR/PaddleOCR) + preprocessing
stt-service       :8003   STT (Whisper container + Deepgram client) + preprocessing
analysis-engine   :8004   SLM analysis (complexity/subject/reasoning/intent) via OpenRouter
router-service    :8005   routing algorithm + OpenRouter generation + fallback + SSE
```

> **Note:** the original 8-service split folded `input-processor`, `response-builder`,
> and `worker` into `orchestrator` to keep the Render service count (and bill) sane.
> Code is still organized under their own modules inside `orchestrator/src/`.

## 5. Vercel boundary (what runs where, and why)

Vercel serverless functions have timeouts (10s Hobby / 60s Pro). Multi-modal flows
that include OCR + SLM analysis + routing + generation routinely exceed those. So:

- **Vercel (fast path):** auth middleware, rate limiting, request intake, SSE relay,
  dashboard UI, all CRUD endpoints (`/system-instructions`, `/models`, `/analytics`).
- **Render (heavy path):** everything that touches media bytes, ML engines, or long
  model calls. Vercel hands off via an internal HTTPS call to the `orchestrator`
  and streams the response back to the browser over SSE.

## 6. Data residency & region

- Supabase region: chosen to match Render service region (low-latency internal calls).
- Media files live in Supabase Storage in the same region; signed URLs served to
  Render services, never proxied through Vercel.

## 7. Environments

| Env | Vercel | Render | Supabase |
|---|---|---|---|
| Local | `pnpm dev` | docker-compose | local Supabase (Docker) |
| Preview | Vercel preview deploys (per-PR) | Render preview env | staging Supabase project |
| Production | main branch | main branch | production Supabase project |

## 8. Secrets

- **Local:** `.env` (gitignored).
- **Vercel / Render / Supabase:** platform secret stores, injected as env vars.
- Service-to-service auth uses a shared `SERVICE_AUTH_TOKEN` (rotated per environment).
- OpenRouter / Deepgram / Google keys are stored once per environment.

## 9. Migration path (if we ever leave this stack)

Every external dependency is behind an interface:
- `LLMProvider` → OpenRouter client (swappable).
- `STTProvider` → Whisper / Deepgram.
- `StorageProvider` → Supabase Storage.
- `AuthProvider` → Supabase Auth.

So moving any one layer later is a localized change, not a rewrite.

---
*Version: 1.0 | Date: 2026-07-12 | Status: Approved*
