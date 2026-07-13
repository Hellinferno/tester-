# Deploy

The app is a **fully client-side, BYOK** web app. Every AI call — chat, OCR
(vision models), STT (audio models), analysis, and web search — goes **from the
browser directly to OpenRouter** using the user's own key (entered in the
sidebar, stored only in `localStorage`).

## What to deploy

Just **Vercel** (the Next.js app):

- Root Directory: `apps/web`
- Framework: Next.js (auto-detected)
- **Environment variables: none required.** No secrets, no Supabase, no SerpAPI.

## Retired

These are no longer used and can be deleted from your dashboards:

- **Render services** — `slm-orchestrator`, `slm-ocr`, `slm-stt`, `slm-analysis`,
  `slm-router`. Delete them in the Render dashboard; the code under `services/`
  is legacy and can be removed from the repo later.
- **Supabase** — the client-side app doesn't use the database. (Keep the project
  if you plan to add auth/persistence back.)
- **SerpAPI** — replaced by OpenRouter's built-in `web` search plugin (billed to
  the user's OpenRouter key).

## Web search

The "Web search" toggle uses OpenRouter's `plugins: [{ id: "web" }]` — no
separate provider or key needed.
