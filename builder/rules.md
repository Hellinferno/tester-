# Development Rules & Standards

## 1. Code Style

### 1.1 Python (PEP 8 + Extensions)

```python
# Formatting
- Line length: 100 characters
- Indentation: 4 spaces
- Quotes: Double for strings, single for dict keys
- Imports: isort (standard, third-party, local)

# Naming
- Classes: PascalCase (e.g., AnalysisEngine)
- Functions: snake_case (e.g., analyze_complexity)
- Constants: UPPER_SNAKE_CASE (e.g., MAX_FILE_SIZE)
- Private: _leading_underscore (e.g., _internal_method)
- Variables: snake_case (e.g., request_id)

# Type Hints
from typing import Optional, List, Dict, Any

def process_image(
 image: Image.Image,
 config: Optional[OCRConfig] = None
) -> OCRResult:
 ...

# Docstrings (Google Style)
def analyze_complexity(query: str) -> ComplexityResult:
 """Analyze query complexity using remote SLM via OpenRouter.

 Args:
 query: The user query text to analyze.

 Returns:
 ComplexityResult with level, score, and reasoning.

 Raises:
 AnalysisError: If SLM inference fails.
 """
```

### 1.2 TypeScript/JavaScript

```typescript
// Formatting
- Line length: 100 characters
- Indentation: 2 spaces
- Semicolons: required
- Quotes: single

// Naming
- Classes: PascalCase
- Interfaces: PascalCase with I prefix (e.g., IRequest)
- Functions: camelCase
- Constants: UPPER_SNAKE_CASE
- Variables: camelCase
- Files: kebab-case (e.g., query-builder.tsx)

// Types
interface AnalysisResult {
 complexity: ComplexityLevel;
 subject: string;
 confidence: number;
}

// Functions
async function analyzeQuery(request: QueryRequest): Promise<AnalysisResult> {
 // Implementation
}
```

## 2. Architecture Rules

### 2.1 Service Boundaries
- Each service MUST have a single responsibility
- Services MUST communicate via defined APIs, not direct DB access
- Shared code MUST go in `packages/`, not duplicated
- Services MUST NOT depend on internal implementation details of other services

### 2.2 API Design
- RESTful endpoints MUST use standard HTTP methods
- Resources MUST be plural nouns (e.g., `/queries`, not `/query`)
- Query parameters MUST use camelCase
- Request/response bodies MUST use camelCase (TypeScript) or snake_case (Python)
- Error responses MUST follow RFC 7807 (Problem Details)

### 2.3 Database Rules
- Migrations MUST be immutable (never edit after commit)
- Schema changes MUST include rollback migration
- Indexes MUST be added for queries running > 100ms
- JSONB columns MUST have GIN indexes for queried fields
- Soft deletes preferred over hard deletes

## 3. Security Rules

### 3.1 Mandatory Practices
- NEVER commit secrets to repository (use `.env.example`)
- ALWAYS validate user input at API boundary
- ALWAYS use parameterized queries (prevent SQL injection)
- ALWAYS escape output in HTML (prevent XSS)
- NEVER log sensitive data (PII, passwords, API keys)
- ALWAYS use HTTPS in production
- ALWAYS hash passwords (Argon2)
- ALWAYS sign JWTs (RS256, not HS256)

### 3.2 API Security
- Rate limiting: 100 req/min per user, 1000 req/min per API key
- Input validation: Max file sizes, allowed formats, character limits
- CORS: Whitelist origins, no wildcards in production
- API keys: Rotate every 90 days
- Authentication: Required for all endpoints except health checks

## 4. Testing Rules

### 4.1 Coverage Requirements
- Unit tests: Minimum 80% coverage
- Integration tests: All critical paths
- E2E tests: All user journeys
- OCR tests: Minimum 100 test images per engine
- STT tests: Minimum 50 audio samples per engine

### 4.2 Test Quality
- Tests MUST be independent (no shared state)
- Tests MUST use descriptive names (`test_extracts_text_from_clean_image`)
- Tests MUST use factories/fixtures, not hardcoded data
- Tests MUST clean up resources (temp files, DB entries)
- Flaky tests MUST be fixed or removed

## 5. Git Rules

### 5.1 Branch Protection
- `main`: Requires 2 approvals, CI passing, up-to-date branch
- `develop`: Requires 1 approval, CI passing
- No force push to protected branches
- No direct commits to `main` or `develop`

### 5.2 Commit Rules
- Commits MUST be atomic (single logical change)
- Commits MUST follow conventional commit format
- Commit messages MUST explain WHY, not just WHAT
- Large changes MUST be split into multiple commits

## 6. Documentation Rules

### 6.1 Code Documentation
- All public APIs MUST have docstrings
- All complex algorithms MUST have inline comments
- All configuration options MUST be documented
- README files MUST exist in every service directory

### 6.2 Architecture Decision Records (ADRs)
- Major decisions MUST be documented in `docs/adr/`
- Format: `YYYY-MM-DD-title.md`
- Include: Context, Decision, Consequences

## 7. Performance Rules

### 7.1 Response Times
- API responses MUST complete within 5s (p95)
- Database queries MUST complete within 100ms
- Cache lookups MUST complete within 10ms
- OCR processing MUST complete within 3s per page
- STT processing MUST complete within 2x real-time

### 7.2 Resource Usage
- Services MUST set memory limits in Docker/K8s
- Services MUST handle backpressure (queue limits)
- Images MUST be optimized before storage (WebP conversion)
- Audio MUST be compressed before storage (Opus encoding)

## 8. Error Handling Rules

### 8.1 Error Design
- All errors MUST have unique error codes
- All errors MUST include request_id for tracing
- All errors MUST be logged with full context
- User-facing errors MUST NOT expose internal details
- Retryable errors MUST include Retry-After header

### 8.2 Retry Logic
- Transient errors: 3 retries with exponential backoff
- Network errors: Retry immediately then backoff
- Rate limits: Respect Retry-After header
- Timeout errors: Do not retry (fail fast)

## 9. Monitoring Rules

### 9.1 Logging
- All services MUST use structured JSON logging
- All requests MUST log: method, path, status, latency, request_id
- All errors MUST log: error code, message, stack trace, context
- Log levels: DEBUG (dev), INFO (production), ERROR (always)

### 9.2 Metrics
- All services MUST expose `/metrics` endpoint
- Required metrics: request_count, request_latency, error_count
- Business metrics: routing_accuracy, ocr_accuracy, stt_wer
- Metrics MUST use Prometheus naming conventions

## 10. Deployment Rules

### 10.1 Container Rules
- Images MUST use non-root user
- Images MUST include health checks
- Images MUST be scanned for vulnerabilities before deployment
- Images MUST be tagged with Git commit SHA

### 10.2 Kubernetes Rules
- All deployments MUST have resource limits
- All services MUST have liveness and readiness probes
- All secrets MUST use External Secrets Operator
- All ingresses MUST have TLS configured
- Pod disruption budgets MUST be defined for critical services

## 11. AI/ML Specific Rules

### 11.1 Model Management
- Model selection MUST be pinned in configuration
- Model updates MUST go through A/B testing
- OpenRouter API calls MUST have timeout guards
- Fallback models MUST be configured for reliability

### 11.2 Prompt Engineering
- Prompts MUST be versioned in Git
- Prompts MUST include input sanitization
- Prompts MUST NOT contain hardcoded secrets
- Prompt changes MUST be tested with evaluation suite

### 11.3 Data Privacy
- User data MUST NOT be used for model training without consent
- PII MUST be redacted before logging or analysis
- Data retention MUST follow GDPR (max 30 days for logs)
- Right to deletion MUST be implemented

## 12. Review Checklist

Before submitting PR, verify:
- [ ] Code follows style guidelines (lint passing)
- [ ] Tests added and passing (> 80% coverage)
- [ ] Documentation updated (README, API docs)
- [ ] No secrets or credentials in code
- [ ] Error handling implemented
- [ ] Logging added for observability
- [ ] Performance impact considered
- [ ] Security implications reviewed
- [ ] Database migrations included (if needed)
- [ ] Backward compatibility maintained

---
*Version: 1.0 | Date: 2026-07-12*
