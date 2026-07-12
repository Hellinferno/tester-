# SLM Router — Multi-Modal SLM Query Router & Response System

An intelligent gateway that accepts **five input modalities** (image+text, image+voice, image-only, voice-only, text-only), performs OCR and STT, analyzes the query via a Small Language Model (SLM) through **OpenRouter**, and routes to the optimal model for response generation.

> **Deployment target:** Vercel (web + gateway) · Render (ML services) · Supabase (Postgres + Auth + Storage).
> See [`builder/12-deployment-target.md`](./builder/12-deployment-target.md) for the spec→reality mapping.

## Architecture

```
                       ┌─────────────────────────────────────────────┐
  Browser ───────────► │  Vercel: apps/web (Next.js)                 │
                       │  • Dashboard UI                             │
                       │  • API gateway (auth, rate-limit, intake)   │
                       │  • SSE streaming                            │
                       └──────────────────────┬──────────────────────┘
                                              │  internal HTTPS (SSE)
                       ┌──────────────────────▼──────────────────────┐
                       │  Render: orchestrator (FastAPI)             │
                       │  • input validation / modality detection    │
                       │  • flow coordination                        │
                       │  • response assembly                        │
                       └───┬──────────┬──────────┬──────────┬────────┘
                           │          │          │          │
            ┌──────────────▼┐ ┌───────▼─────┐ ┌──▼────────┐ ┌▼──────────────┐
            │ ocr-service   │ │ stt-service │ │ analysis- │ │ router-service│
            │ Tesseract /   │ │ Whisper +   │ │ engine    │ │ OpenRouter gen│
            │ EasyOCR /     │ │ Deepgram    │ │ (SLM via  │ │ + fallback +  │
            │ PaddleOCR     │ │             │ │ OpenRouter│ │ scoring       │
            └───────────────┘ └─────────────┘ └───────────┘ └───────────────┘
                                              │
                       ┌──────────────────────┴──────────────────────┐
                       │  Supabase: Postgres · Auth · Storage (S3)   │
                       │  Upstash: Redis (cache + job queue)         │
                       └─────────────────────────────────────────────┘
```

## Monorepo layout

```
apps/web/             Next.js dashboard + Vercel API gateway
services/orchestrator FastAPI — input + flow + response assembly
services/ocr-service  FastAPI — OCR (Tesseract/EasyOCR/PaddleOCR)
services/stt-service  FastAPI — STT (Whisper + Deepgram)
services/analysis-engine  FastAPI — SLM analysis via OpenRouter
services/router-service    FastAPI — routing + generation + SSE
packages/shared-types      Shared TypeScript models
packages/shared-python     Shared Pydantic models + clients
packages/ui-components     Design system + components
packages/config            Env validation + per-env config
supabase/                  Migrations, RLS, seed, storage buckets
infra/docker               Local dev docker-compose
infra/render               Render blueprints
infra/vercel               Vercel config
```

## Quick start

```bash
pnpm install                 # JS deps
pnpm docker:up               # local Supabase + Redis (+ optional services)
pnpm db:reset && pnpm db:seed
pnpm dev                     # web + services in parallel (turbo)
```

Python services use per-service venvs:
```bash
cd services/orchestrator && python -m venv .venv && . .venv/Scripts/activate
pip install -e ../../packages/shared-python -r requirements.txt
pytest
```

## Scripts (replace the `make` targets from the docs)

| pnpm script | Purpose |
|---|---|
| `pnpm dev` | Run web + services in parallel |
| `pnpm test` | All unit/integration tests |
| `pnpm test:coverage` | With coverage |
| `pnpm test:e2e` | Playwright end-to-end |
| `pnpm py:test:ocr` / `:stt` / `:analysis` / `:router` / `:orchestrator` | Per-service pytest |
| `pnpm docker:up` / `:down` / `:logs` | Local infra |
| `pnpm db:reset` / `:push` / `:seed` | Supabase migrations |
| `pnpm db:types` | Regenerate TS types from Supabase |

Copy `.env.example` to `.env` and fill in your keys before running.

## Documentation

Full design docs live in [`builder/`](./builder/):
- [`01-product-requirements.md`](./builder/01-product-requirements.md) — PRD
- [`05-database-schema.md`](./builder/05-database-schema.md) — schema (10 tables)
- [`06-api-contracts.md`](./builder/06-api-contracts.md) — REST + SSE contracts
- [`08-computation-engine-spec.md`](./builder/08-computation-engine-spec.md) — routing algorithm
- [`10-development-phases.md`](./builder/10-development-phases.md) — phase plan
- [`12-deployment-target.md`](./builder/12-deployment-target.md) — **Vercel/Render/Supabase decisions**
- [`UI.md`](./builder/UI.md) — design system
- [`rules.md`](./builder/rules.md) — coding standards

---
*Version: 0.1.0 | Status: Phase 0 — Foundation*
# tester-
