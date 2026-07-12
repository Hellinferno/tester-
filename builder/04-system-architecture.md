# System Architecture

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ CLIENT LAYER │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │ Web App │ │ iOS App │ │AndroidApp│ │ API │ │ SDK │ │
│ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ │
└───────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────┘
 │ │ │ │ │
 └─────────────┴─────────────┴─────────────┴─────────────┘
 │
 ┌─────────▼─────────┐
 │ API Gateway │
 │ (Kong/AWS API GW) │
 │ • Rate Limiting │
 │ • Authentication │
 │ • Load Balancing │
 └─────────┬─────────┘
 │
┌───────────────────────────────────▼─────────────────────────────────────┐
│ SERVICE LAYER │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐ │
│ │ Gateway │ │ Input │ │ Analysis │ │ Router │ │
│ │ Service │ │ Processor │ │ Engine │ │ Service │ │
│ │ │ │ Service │ │ (SLM) │ │ │ │
│ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └────┬─────┘ │
│ │ │ │ │ │
│ ┌──────▼───────┐ ┌──────▼───────┐ ┌──────▼───────┐ ┌────▼─────┐ │
│ │ OCR │ │ STT │ │ Response │ │ Model │ │
│ │ Service │ │ Service │ │ Builder │ │ Cache │ │
│ │ (Tesseract/│ │ (Whisper/ │ │ │ │ │ │
│ │ EasyOCR) │ │ Deepgram) │ │ │ │ │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘ │
└───────────────────────────────────┬───────────────────────────────────┘
 │
┌───────────────────────────────────▼─────────────────────────────────────┐
│ DATA LAYER │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐ │
│ │ PostgreSQL │ │ Redis │ │ MinIO/ │ │ Pinecone │ │
│ │ (Primary) │ │ (Cache) │ │ S3 │ │ (Vector)│ │
│ │ │ │ │ │ (Object St) │ │ │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
 │
 ┌─────────▼─────────┐
 │ EXTERNAL APIs │
 │ • OpenRouter │
 │ • Google Search │
 │ • Google Maps │
 │ • Custom Models │
 └───────────────────┘
```

## 2. Component Details

### 2.1 API Gateway
- **Technology**: Kong / AWS API Gateway / Nginx
- **Responsibilities**:
 - JWT/OAuth2 authentication
 - Rate limiting (100 req/min per user, 1000 req/min per API key)
 - Request routing to services
 - SSL termination
 - Request/response logging

### 2.2 Gateway Service
- **Technology**: Node.js / Python FastAPI
- **Responsibilities**:
 - Request validation
 - Content negotiation
 - Session management
 - Error handling & formatting
 - WebSocket management (for streaming)

### 2.3 Input Processor Service
- **Technology**: Python (FastAPI + Celery)
- **Responsibilities**:
 - Media validation (type, size, format)
 - Media preprocessing (resize, normalize, transcoding)
 - Input modality detection
 - Temporary storage coordination
 - Input sanitization

### 2.4 OCR Service
- **Technology**: Python (Tesseract + EasyOCR + PaddleOCR)
- **Responsibilities**:
 - Text extraction from images
 - Confidence scoring per word/line
 - Bounding box generation
 - Language detection
 - Handwriting recognition
 - Table/form extraction
- **Deployment**: CPU-enabled containers for heavy processing

### 2.5 STT Service
- **Technology**: Python (OpenAI Whisper + Deepgram API)
- **Responsibilities**:
 - Audio transcription
 - Speaker diarization (optional)
 - Word-level timestamps
 - Language detection
 - Noise robustness
 - Punctuation restoration

### 2.6 Analysis Engine (SLM)
- **Technology**: Python (vLLM / OpenRouter SLM)
- **Model**: Small OpenRouter SLM (Llama 3.1 8B, Phi-4, or Gemma 2B)
- **Responsibilities**:
 - Query complexity analysis
 - Subject classification
 - Reasoning depth assessment
 - Intent extraction
 - Output format prediction
 - System instruction selection
- **Key Feature**: Called via OpenRouter API for fast analysis before routing

### 2.7 Router Service
- **Technology**: Python (FastAPI + Redis)
- **Responsibilities**:
 - Model selection based on analysis
 - Cost/latency optimization
 - Fallback chain management
 - A/B testing support
 - Model performance tracking
 - OpenRouter API key rotation

### 2.8 Response Builder
- **Technology**: Python (FastAPI)
- **Responsibilities**:
 - Response formatting
 - Streaming support
 - Citation management (for grounded responses)
 - Multi-modal response assembly
 - Token usage tracking

## 3. Communication Patterns

### 3.1 Synchronous (REST/WebSocket)
- Client → Gateway: HTTP/2 or WebSocket
- Gateway → Services: gRPC or HTTP/REST
- Router → OpenRouter: HTTPS REST

### 3.2 Asynchronous (Message Queue)
- Input Processor → OCR Service: Redis Queue / RabbitMQ
- Input Processor → STT Service: Redis Queue / RabbitMQ
- Analysis Engine → Router: Redis Pub/Sub
- All services → Logging: Kafka (optional)

### 3.3 Event Flow
```
1. Client uploads request → Gateway
2. Gateway publishes "input.received" event
3. Input Processor validates → publishes "input.validated"
4. If image present → OCR Service processes → publishes "ocr.completed"
5. If voice present → STT Service processes → publishes "stt.completed"
6. Analysis Engine calls OpenRouter (cheap model) → publishes "analysis.completed"
7. Router consumes analysis → selects model → publishes "routing.decided"
8. Response Builder calls OpenRouter → publishes "response.generated"
9. Gateway streams response to client
```

## 4. Scalability Design

### 4.1 Horizontal Scaling
- Gateway: Stateless, scale via load balancer
- OCR/STT: Queue-based workers, scale based on queue depth
- Analysis Engine: Remote SLM via OpenRouter, can run on edge or centralized
- Router: Stateless, scale via load balancer

### 4.2 Caching Strategy
- **Request Cache**: Redis (identical requests)
- **Analysis Cache**: Redis (similar queries via semantic hash)
- **Model Response Cache**: Redis (for deterministic queries)
- **Media Cache**: CDN (processed images/audio)

### 4.3 Database Sharding
- Shard by `user_id` for user data
- Shard by `request_id` for request logs
- Time-based partitioning for analytics tables

## 5. Security Architecture

### 5.1 Authentication
- API Key + Secret for service-to-service
- JWT for user authentication
- OAuth2 for third-party integrations

### 5.2 Authorization
- RBAC (Role-Based Access Control)
- Model access permissions
- Rate limit tiers (Free, Pro, Enterprise)

### 5.3 Data Protection
- TLS 1.3 for all communications
- AES-256 encryption at rest
- PII redaction in logs
- GDPR-compliant data retention

## 6. Monitoring & Observability

### 6.1 Metrics (Prometheus)
- Request rate by modality
- Response latency percentiles (p50, p95, p99)
- OCR accuracy scores
- STT WER scores
- Model routing accuracy
- OpenRouter API costs
- Error rates by service

### 6.2 Logging (ELK Stack / Loki)
- Structured JSON logs
- Distributed tracing (OpenTelemetry)
- Request correlation IDs
- Audit logs for model decisions

### 6.3 Alerting (PagerDuty / Opsgenie)
- Latency > threshold
- Error rate > 1%
- OpenRouter API failures
- OCR/STT accuracy degradation
- Disk/CPU/Memory thresholds

---
*Version: 1.0 | Date: 2026-07-12*
