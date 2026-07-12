# System Design Document

## 1. Design Philosophy

### 1.1 Principles
1. **Modularity**: Each service is independent, replaceable, and scalable
2. **Intelligence at the Edge**: Remote SLM via OpenRouter for fast analysis, cloud LLM for quality responses
3. **Multi-Modal First**: Design around diverse input types from day one
4. **Cost Awareness**: Every routing decision considers cost-efficiency
5. **Observability**: Every component is measurable, traceable, and alertable

### 1.2 Design Patterns
- **API Gateway**: Single entry point for all clients
- **Strangler Fig**: Gradually replace components without disruption
- **CQRS**: Separate read/write paths for analytics
- **Saga**: Distributed transactions for multi-step processing
- **Circuit Breaker**: Fail fast when external services degrade

## 2. System Context

```
┌─────────────────────────────────────────────────────────────────┐
│ EXTERNAL SYSTEMS │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│ │ OpenRouter│ │ Deepgram │ │ Google │ │ Google │ │
│ │ API │ │ API │ │ Search │ │ Maps │ │
│ └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘ │
│ │ │ │ │ │
└───────┼─────────────┼─────────────┼───────────────┼───────────┘
 │ │ │ │
 └─────────────┴─────────────┴───────────────┘
 │
┌─────────────────────────▼─────────────────────────────────────┐
│ SLM ROUTER SYSTEM │
│ │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│ │ API │ │ Input │ │ OCR │ │
│ │ Gateway │───▶│ Processor │───▶│ Service │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ │
│ │ │ │ │
│ │ ┌──────▼──────┐ ┌────▼─────┐ │
│ │ │ STT │ │ Media │ │
│ │ │ Service │ │ Storage │ │
│ │ └──────┬──────┘ └──────────┘ │
│ │ │ │
│ │ ┌──────▼──────┐ │
│ │ │ Analysis │ │
│ │ │ Engine │ │
│ │ │ (SLM) │ │
│ │ └──────┬──────┘ │
│ │ │ │
│ │ ┌──────▼──────┐ │
│ │ │ Model │ │
│ │ │ Router │ │
│ │ └──────┬──────┘ │
│ │ │ │
│ │ ┌──────▼──────┐ │
│ │ │ Response │ │
│ │ │ Builder │ │
│ │ └──────┬──────┘ │
│ │ │ │
│ ┌──────▼────────────────────▼──────┐ │
│ │ Web Dashboard │ │
│ │ (Next.js + React + Tailwind) │ │
│ └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 3. Component Design

### 3.1 API Gateway

**Responsibilities:**
- Authentication (JWT, API Key)
- Rate limiting (token bucket algorithm)
- Request routing
- SSL termination
- CORS handling
- Request ID generation
- Basic logging

**Technology Stack:**
- Kong / AWS API Gateway / Nginx + Lua
- Node.js Express (custom gateway)
- Redis for rate limiting state

**Key Design Decisions:**
- Stateless design for horizontal scaling
- WebSocket support for streaming responses
- Request body size limits (100MB for media)
- Timeout configuration per endpoint

### 3.2 Input Processor

**Responsibilities:**
- Content validation (magic number checking)
- Format conversion (HEIC→JPEG, FLAC→WAV)
- Metadata extraction (EXIF, ID3 tags)
- Virus scanning (ClamAV integration)
- PII detection and redaction
- Thumbnail generation (images)
- Waveform generation (audio)
- Input modality classification

**State Machine:**
```
RECEIVED → VALIDATING → VALIDATED → PREPROCESSING → PROCESSED → QUEUED
 ↓ ↓ ↓ ↓
 INVALID REJECTED FAILED RETRY
```

### 3.3 OCR Service

**Architecture:**
```
Input Image → Preprocessor → Engine Selector → OCR Engine → Postprocessor → Result
 ↓ ↓ ↓ ↓
 Denoise Language Tesseract Confidence
 Deskew Detection EasyOCR Scoring
 Contrast Engine Score PaddleOCR Layout
```

**Engine Selection Logic:**
```python
def select_engine(image, requirements):
 if requirements.language in ['chinese', 'japanese', 'korean']:
 return 'paddleocr'
 elif requirements.handwriting:
 return 'easyocr'
 elif requirements.table_extraction:
 return 'paddleocr'
 else:
 return 'tesseract' # fastest for clean printed text
```

### 3.4 STT Service

**Architecture:**
```
Input Audio → Preprocessor → VAD → Engine Selector → STT Engine → Postprocessor
 ↓ ↓ ↓ ↓ ↓
 Noise Red. Silence Whisper Deepgram Punctuation
 Normalize Detection (accuracy) (speed) Diarization
```

**Real-time vs Batch:**
- Batch mode: Full file processing, higher accuracy
- Streaming mode: Chunk-based processing for real-time (future)

### 3.5 Analysis Engine (SLM)

**Architecture:**
```
Context Assembly → Parallel Analysis → Aggregation → Instruction Selection
 ↓ ↓ ↓ ↓
 OCR+STT+Text Complexity Weighted Profile
 + Metadata Subject Scoring Matching
 Reasoning
 Intent
```

**Remote Model Deployment via OpenRouter:**
- llama.cpp/ctransformers for CPU inference
- GGUF quantization (Q4_K_M) for CPU efficiency
- OpenRouter handles request batching
- OpenRouter handles model scaling

**Prompt Engineering Strategy:**
- Few-shot examples for each analysis type
- Chain-of-thought for complex queries
- JSON mode for structured outputs
- Temperature 0.3 for deterministic analysis

### 3.6 Model Router

**Routing Algorithm:**
```python
def route(analysis, preferences, history):
 # 1. Capability filtering
 candidates = filter_by_capability(all_models, analysis)

 # 2. Scoring
 scores = {}
 for model in candidates:
 scores[model] = (
 capability_score(model, analysis) * 0.4 +
 quality_score(model, analysis, history) * 0.3 +
 cost_score(model, preferences.budget) * 0.15 +
 latency_score(model, preferences.max_latency) * 0.15
 )

 # 3. Selection with confidence threshold
 best = max(scores, key=scores.get)
 confidence = scores[best]

 if confidence < 0.6:
 # Escalate to premium model
 best = get_premium_fallback(best)

 # 4. Fallback chain
 fallbacks = sorted(
 [m for m in candidates if m != best],
 key=lambda m: scores[m],
 reverse=True
 )[:3]

 return RoutingDecision(best, confidence, fallbacks)
```

### 3.7 Response Builder

**Responsibilities:**
- Format standardization (Markdown, JSON, HTML)
- Streaming chunk assembly
- Citation injection (for grounded responses)
- Code block formatting
- Image reference linking
- Token usage tracking
- Finish reason handling

## 4. Data Flow

### 4.1 Image + Text Query

```
1. Client POST /queries with image + text
2. Gateway validates auth and rate limits
3. Input Processor validates image (format, size, virus scan)
4. Image stored in MinIO, metadata in PostgreSQL
5. OCR Service extracts text from image (async via queue)
6. Analysis Engine receives: original text + OCR text + image metadata
7. SLM analyzes complexity, subject, reasoning, intent
8. Instruction Profile selected based on analysis
9. Router selects optimal model (e.g., Claude 3.5 Sonnet for vision+reasoning)
10. OpenRouter API called with selected model + instructions
11. Response Builder formats streaming response
12. Client receives Markdown response with analysis metadata
```

### 4.2 Voice Only Query

```
1. Client POST /queries with audio file
2. Gateway validates auth
3. Input Processor validates audio (format, duration)
4. Audio stored in MinIO
5. STT Service transcribes audio (async via queue)
6. Analysis Engine receives transcript + audio metadata
7. SLM analyzes (voice queries often simpler → may route to faster model)
8. Router selects model
9. OpenRouter API called
10. Response Builder returns text response
11. (Future: TTS option for voice response)
```

## 5. Scalability Design

### 5.1 Horizontal Scaling

| Component | Scaling Trigger | Max Instances |
|-----------|----------------|---------------|
| Gateway | CPU > 70% | 20 |
| Input Processor | Queue depth > 100 | 10 |
| OCR Service | Queue depth > 50 | 10 |
| STT Service | Queue depth > 50 | 8 |
| Analysis Engine | Latency > 2s | 5 |
| Router | CPU > 60% | 10 |

### 5.2 Database Scaling

- **Read Replicas**: 3 replicas for read-heavy analytics
- **Connection Pooling**: PgBouncer with 100 max connections
- **Partitioning**: Time-based partitions for request logs
- **Archival**: Move data > 90 days to cold storage

### 5.3 Caching Strategy

| Cache Layer | Technology | TTL | Use Case |
|-------------|-----------|-----|----------|
| L1 | In-memory (LRU) | 5 min | Analysis results |
| L2 | Redis | 1 hour | Model responses |
| L3 | CDN | 24 hours | Static assets |
| L4 | Vector DB | Persistent | Semantic search |

## 6. Security Design

### 6.1 Threat Model

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| API Key theft | Medium | High | Rotate keys, IP whitelist, rate limits |
| Prompt injection | High | Medium | Input sanitization, output filtering |
| Data exfiltration | Low | Critical | Network policies, audit logging |
| Model hijacking | Low | High | Request validation, output scanning |
| DDoS | Medium | Medium | Rate limiting, CDN, WAF |
| Supply chain | Medium | High | Dependency scanning, SBOM |

### 6.2 Security Controls

```
┌─────────────────────────────────────────┐
│ PERIMETER │
│ • WAF (AWS WAF / CloudFlare) │
│ • DDoS protection │
│ • SSL/TLS 1.3 │
└─────────────────────────────────────────┘
 │
┌─────────────────────────────────────────┐
│ AUTHENTICATION │
│ • JWT (RS256) │
│ • API Keys (HMAC-SHA256) │
│ • OAuth2 (Google, GitHub) │
│ • MFA for admin │
└─────────────────────────────────────────┘
 │
┌─────────────────────────────────────────┐
│ AUTHORIZATION │
│ • RBAC (User, Developer, Admin) │
│ • Resource-level permissions │
│ • Rate limit tiers │
└─────────────────────────────────────────┘
 │
┌─────────────────────────────────────────┐
│ DATA PROTECTION │
│ • AES-256 at rest │
│ • TLS 1.3 in transit │
│ • PII redaction │
│ • GDPR deletion │
└─────────────────────────────────────────┘
```

## 7. Disaster Recovery

### 7.1 RPO/RTO
- **RPO**: 1 hour (data loss acceptable)
- **RTO**: 4 hours (system recovery time)

### 7.2 Backup Strategy
- PostgreSQL: Daily snapshots + WAL archiving
- Redis: Hourly RDB snapshots
- Media: S3 versioning + cross-region replication
- 

### 7.3 Failover Procedures
1. **OpenRouter Failure**: Switch to fallback model provider
2. **SLM Failure**: Use heuristic routing (rule-based)
3. **Database Failure**: Promote read replica
4. **Cache Failure**: Rebuild from database
5. **Full Region Failure**: Activate standby region

---
*Version: 1.0 | Date: 2026-07-12*
