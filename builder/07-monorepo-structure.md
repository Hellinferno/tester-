# Monorepo Structure

## 1. Repository Layout

```
slm-router/
├── .github/
│ ├── workflows/
│ │ ├── ci.yml # Main CI pipeline
│ │ ├── cd-staging.yml # Staging deployment
│ │ ├── cd-production.yml # Production deployment
│ │ ├── ocr-tests.yml # OCR testing pipeline
│ │ └── stt-tests.yml # STT testing pipeline
│ ├── CODEOWNERS
│ └── PULL_REQUEST_TEMPLATE.md
│
├── apps/
│ ├── web/ # Next.js web application
│ │ ├── app/
│ │ │ ├── (dashboard)/
│ │ │ │ ├── queries/
│ │ │ │ ├── analytics/
│ │ │ │ ├── system-instructions/
│ │ │ │ └── settings/
│ │ │ ├── api/
│ │ │ │ └── webhooks/
│ │ │ ├── layout.tsx
│ │ │ └── page.tsx
│ │ ├── components/
│ │ │ ├── QueryBuilder/
│ │ │ ├── MediaUploader/
│ │ │ ├── ResponseStream/
│ │ │ ├── AnalysisPanel/
│ │ │ ├── SystemInstructionEditor/
│ │ │ └── ModelSelector/
│ │ ├── lib/
│ │ ├── hooks/
│ │ ├── types/
│ │ ├── public/
│ │ ├── next.config.js
│ │ ├── tailwind.config.ts
│ │ └── package.json
│ │
│ ├── mobile/ # React Native mobile app (future)
│ │ └── ...
│ │
│ └── docs/ # Docusaurus documentation site
│ ├── docs/
│ ├── docusaurus.config.js
│ └── package.json
│
├── services/
│ ├── gateway/ # API Gateway service
│ │ ├── src/
│ │ │ ├── main.ts
│ │ │ ├── auth/
│ │ │ ├── rate-limit/
│ │ │ ├── routing/
│ │ │ ├── middleware/
│ │ │ └── websocket/
│ │ ├── test/
│ │ ├── Dockerfile
│ │ ├── nest-cli.json
│ │ └── package.json
│ │
│ ├── input-processor/ # Input validation & preprocessing
│ │ ├── src/
│ │ │ ├── main.py
│ │ │ ├── validators/
│ │ │ │ ├── image_validator.py
│ │ │ │ ├── audio_validator.py
│ │ │ │ └── text_validator.py
│ │ │ ├── preprocessors/
│ │ │ │ ├── image_processor.py
│ │ │ │ └── audio_processor.py
│ │ │ ├── handlers/
│ │ │ │ ├── image_text_handler.py
│ │ │ │ ├── image_voice_handler.py
│ │ │ │ ├── image_only_handler.py
│ │ │ │ ├── voice_only_handler.py
│ │ │ │ └── text_only_handler.py
│ │ │ ├── models/
│ │ │ └── utils/
│ │ ├── tests/
│ │ ├── Dockerfile
│ │ ├── requirements.txt
│ │ └── pyproject.toml
│ │
│ ├── ocr-service/ # OCR processing service
│ │ ├── src/
│ │ │ ├── main.py
│ │ │ ├── engines/
│ │ │ │ ├── tesseract_engine.py
│ │ │ │ ├── easyocr_engine.py
│ │ │ │ └── paddleocr_engine.py
│ │ │ ├── preprocessors/
│ │ │ │ ├── denoise.py
│ │ │ │ ├── deskew.py
│ │ │ │ └── contrast.py
│ │ │ ├── postprocessors/
│ │ │ │ ├── confidence_scorer.py
│ │ │ │ └── layout_analyzer.py
│ │ │ ├── models/
│ │ │ └── workers/
│ │ ├── tests/
│ │ │ ├── fixtures/
│ │ │ │ ├── printed_text/
│ │ │ │ ├── handwritten/
│ │ │ │ └── screenshots/
│ │ │ ├── test_ocr_engines.py
│ │ │ └── test_preprocessing.py
│ │ ├── Dockerfile
│ │ ├── requirements.txt
│ │ └── pyproject.toml
│ │
│ ├── stt-service/ # Speech-to-Text service
│ │ ├── src/
│ │ │ ├── main.py
│ │ │ ├── engines/
│ │ │ │ ├── whisper_engine.py
│ │ │ │ └── deepgram_engine.py
│ │ │ ├── preprocessors/
│ │ │ │ ├── noise_reduction.py
│ │ │ │ ├── normalization.py
│ │ │ │ └── vad.py # Voice Activity Detection
│ │ │ ├── postprocessors/
│ │ │ │ ├── punctuation.py
│ │ │ │ └── speaker_diarization.py
│ │ │ └── workers/
│ │ ├── tests/
│ │ │ ├── fixtures/
│ │ │ │ ├── clean_audio/
│ │ │ │ ├── noisy_audio/
│ │ │ │ └── accented/
│ │ │ └── test_stt_engines.py
│ │ ├── Dockerfile
│ │ ├── requirements.txt
│ │ └── pyproject.toml
│ │
│ ├── analysis-engine/ # SLM Analysis Engine
│ │ ├── src/
│ │ │ ├── main.py
│ │ │ ├── models/
│ │ │ │ ├── complexity_analyzer.py
│ │ │ │ ├── subject_classifier.py
│ │ │ │ ├── reasoning_assessor.py
│ │ │ │ ├── intent_extractor.py
│ │ │ │ └── output_predictor.py
│ │ │ ├── llm/
│ │ │ │ ├── openrouter_client.py # vLLM/ wrapper
│ │ │ │ ├── prompt_templates/
│ │ │ │ │ ├── complexity_prompt.txt
│ │ │ │ │ ├── subject_prompt.txt
│ │ │ │ │ ├── reasoning_prompt.txt
│ │ │ │ │ └── intent_prompt.txt
│ │ │ │ └── model_manager.py
│ │ │ ├── system_instructions/
│ │ │ │ ├── selector.py
│ │ │ │ └── profiles/
│ │ │ └── utils/
│ │ ├── tests/
│ │ ├── Dockerfile
│ │ ├── requirements.txt
│ │ └── pyproject.toml
│ │
│ ├── router-service/ # Model Router Service
│ │ ├── src/
│ │ │ ├── main.py
│ │ │ ├── strategies/
│ │ │ │ ├── cost_optimizer.py
│ │ │ │ ├── latency_optimizer.py
│ │ │ │ ├── quality_optimizer.py
│ │ │ │ └── balanced.py
│ │ │ ├── providers/
│ │ │ │ ├── openrouter_client.py
│ │ │ │ ├── fallback_manager.py
│ │ │ │ └── key_rotator.py
│ │ │ ├── models/
│ │ │ └── evaluators/
│ │ │ └── routing_accuracy.py
│ │ ├── tests/
│ │ ├── Dockerfile
│ │ ├── requirements.txt
│ │ └── pyproject.toml
│ │
│ ├── response-builder/ # Response formatting service
│ │ ├── src/
│ │ │ ├── main.py
│ │ │ ├── formatters/
│ │ │ ├── streamers/
│ │ │ └── citation_manager.py
│ │ ├── tests/
│ │ ├── Dockerfile
│ │ └── requirements.txt
│ │
│ └── worker/ # Background task worker
│ ├── src/
│ │ ├── main.py
│ │ ├── tasks/
│ │ │ ├── ocr_task.py
│ │ │ ├── stt_task.py
│ │ │ ├── cleanup_task.py
│ │ │ └── report_task.py
│ │ └── celery_config.py
│ ├── Dockerfile
│ └── requirements.txt
│
├── packages/
│ ├── shared-types/ # Shared TypeScript types
│ │ ├── src/
│ │ │ ├── api.ts
│ │ │ ├── models.ts
│ │ │ ├── analysis.ts
│ │ │ └── index.ts
│ │ ├── package.json
│ │ └── tsconfig.json
│ │
│ ├── shared-python/ # Shared Python utilities
│ │ ├── src/
│ │ │ ├── __init__.py
│ │ │ ├── models/
│ │ │ │ ├── __init__.py
│ │ │ │ ├── request.py
│ │ │ │ ├── response.py
│ │ │ │ └── analysis.py
│ │ │ ├── utils/
│ │ │ │ ├── logging.py
│ │ │ │ ├── crypto.py
│ │ │ │ └── validators.py
│ │ │ └── clients/
│ │ │ ├── redis_client.py
│ │ │ ├── postgres_client.py
│ │ │ └── minio_client.py
│ │ ├── pyproject.toml
│ │ └── setup.py
│ │
│ ├── ui-components/ # Shared React components
│ │ ├── src/
│ │ │ ├── components/
│ │ │ ├── hooks/
│ │ │ └── utils/
│ │ ├── package.json
│ │ └── tailwind.config.ts
│ │
│ └── config/ # Shared configuration schemas
│ ├── src/
│ │ ├── default.yaml
│ │ ├── development.yaml
│ │ ├── staging.yaml
│ │ └── production.yaml
│ └── package.json
│
├── infra/
│ ├── terraform/
│ │ ├── modules/
│ │ │ ├── vpc/
│ │ │ ├── eks/
│ │ │ ├── rds/
│ │ │ ├── elasticache/
│ │ │ └── s3/
│ │ ├── environments/
│ │ │ ├── dev/
│ │ │ ├── staging/
│ │ │ └── production/
│ │ └── main.tf
│ │
│ ├── kubernetes/
│ │ ├── base/
│ │ │ ├── namespace.yaml
│ │ │ ├── configmap.yaml
│ │ │ ├── secrets.yaml
│ │ │ └── ingress.yaml
│ │ ├── services/
│ │ │ ├── gateway/
│ │ │ ├── input-processor/
│ │ │ ├── ocr-service/
│ │ │ ├── stt-service/
│ │ │ ├── analysis-engine/
│ │ │ ├── router-service/
│ │ │ └── response-builder/
│ │ └── overlays/
│ │ ├── dev/
│ │ ├── staging/
│ │ └── production/
│ │
│ ├── docker/
│ │ ├── docker-compose.yml # Local development
│ │ ├── docker-compose.test.yml # Testing environment
│ │ └── .env.example
│ │
│ └── scripts/
│ ├── setup-local.sh
│ ├── deploy-staging.sh
│ └── deploy-production.sh
│
├── docs/ # Project documentation (this repo)
│ ├── 01-product-requirements.md
│ ├── 02-information-architecture.md
│ ├── 04-system-architecture.md
│ ├── 05-database-schema.md
│ ├── 06-api-contracts.md
│ ├── 07-monorepo-structure.md
│ ├── 08-computation-engine-spec.md
│ ├── 09-engineering-scope-definition.md
│ ├── 10-development-phases.md
│ ├── 11-environment-and-devops.md
│ ├── INTEGRATION_GUIDE.md
│ ├── PRD-doc.md
│ ├── system-design-doc.md
│ ├── developer.md
│ ├── rules.md
│ ├── testing.md
│ └── UI.md
│
├── tests/
│ ├── e2e/ # End-to-end tests
│ │ ├── cypress/
│ │ └── playwright/
│ ├── integration/ # Integration tests
│ │ ├── api/
│ │ └── services/
│ ├── load/ # Load testing
│ │ ├── k6/
│ │ └── locust/
│ └── fixtures/
│ ├── images/
│ ├── audio/
│ └── text/
│
├── .cursorrules
├── .gitignore
├── .editorconfig
├── Makefile
├── README.md
├── LICENSE
├── pnpm-workspace.yaml # PNPM workspace config
├── pnpm-lock.yaml
├── turbo.json # Turborepo config
└── package.json
```

## 2. Package Management

### 2.1 Workspace Configuration (pnpm)
```yaml
# pnpm-workspace.yaml
packages:
 - 'apps/*'
 - 'services/*'
 - 'packages/*'
```

### 2.2 Root package.json
```json
{
 "name": "slm-router",
 "private": true,
 "version": "1.0.0",
 "packageManager": "pnpm@9.0.0",
 "scripts": {
 "build": "turbo run build",
 "dev": "turbo run dev --parallel",
 "test": "turbo run test",
 "lint": "turbo run lint",
 "format": "prettier --write "**/*.{ts,tsx,md,json}"",
 "docker:build": "docker-compose -f infra/docker/docker-compose.yml build",
 "docker:up": "docker-compose -f infra/docker/docker-compose.yml up -d",
 "docker:down": "docker-compose -f infra/docker/docker-compose.yml down",
 "k8s:apply": "kubectl apply -k infra/kubernetes/overlays/dev",
 "tf:plan": "cd infra/terraform && terraform plan",
 "tf:apply": "cd infra/terraform && terraform apply"
 },
 "devDependencies": {
 "turbo": "^2.0.0",
 "prettier": "^3.0.0",
 "@types/node": "^20.0.0"
 }
}
```

### 2.3 Turborepo Pipeline
```json
{
 "$schema": "https://turbo.build/schema.json",
 "globalDependencies": ["**/.env.*local"],
 "globalEnv": ["NODE_ENV", "API_KEY"],
 "tasks": {
 "build": {
 "dependsOn": ["^build"],
 "outputs": [".next/**", "!.next/cache/**", "dist/**"]
 },
 "test": {
 "dependsOn": ["build"]
 },
 "lint": {},
 "dev": {
 "cache": false,
 "persistent": true
 }
 }
}
```

## 3. Service Dependencies

```
Gateway
├── depends on: Redis, PostgreSQL
├── communicates with: Input Processor, Response Builder

Input Processor
├── depends on: Redis, MinIO
├── communicates with: OCR Service, STT Service, Analysis Engine

OCR Service
├── depends on: Redis, MinIO
├── communicates with: Input Processor (async)

STT Service
├── depends on: Redis, MinIO
├── communicates with: Input Processor (async)

Analysis Engine
├── depends on: Redis, PostgreSQL, OpenRouter API
├── communicates with: Input Processor, Router Service, OpenRouter

Router Service
├── depends on: Redis, PostgreSQL
├── communicates with: Analysis Engine, Response Builder, OpenRouter

Response Builder
├── depends on: Redis, PostgreSQL
├── communicates with: Router Service, Gateway
```

## 4. Development Workflow

### 4.1 Local Development
```bash
# 1. Clone and setup
git clone git@github.com:org/slm-router.git
cd slm-router
pnpm install

# 2. Start infrastructure
docker-compose -f infra/docker/docker-compose.yml up -d

# 3. Start all services in dev mode
pnpm dev

# 4. Run tests
pnpm test
```

### 4.2 Service-Specific Development
```bash
# Work on a specific service
cd services/ocr-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install -e ../../packages/shared-python
python -m pytest
```

## 5. Build & Deployment

### 5.1 CI/CD Pipeline
```
1. Lint & Format Check
2. Unit Tests (parallel per service)
3. Integration Tests
4. Build Docker Images
5. Security Scan (Trivy)
6. Push to Registry
7. Deploy to Staging
8. E2E Tests on Staging
9. Deploy to Production (manual approval)
```

### 5.2 Docker Strategy
- Each service has its own Dockerfile
- Multi-stage builds for optimization
- Base image: `python:3.11-slim` (Python services), `node:20-alpine` (Node services)
- Shared layers via base images

---
*Version: 1.0 | Date: 2026-07-12*
