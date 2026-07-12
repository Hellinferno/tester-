# Testing Strategy & Workflow Testing

## 1. Testing Philosophy

> "Test early, test often, test realistically. Every feature must be provably correct before deployment."

## 2. Test Categories

### 2.1 Unit Tests

**Purpose**: Validate individual functions and classes in isolation
**Scope**: Single service, single module
**Tools**: Pytest (Python), Jest (JavaScript)
**Frequency**: Every commit
**Coverage Target**: 80%

### 2.2 Integration Tests

**Purpose**: Validate service interactions and API contracts
**Scope**: Multiple services, database, message queues
**Tools**: pytest-asyncio, supertest, TestContainers
**Frequency**: Every PR
**Coverage Target**: All critical paths

### 2.3 End-to-End Tests

**Purpose**: Validate complete user workflows
**Scope**: Full system, browser automation
**Tools**: Playwright, Cypress
**Frequency**: Daily, before release
**Coverage Target**: All user journeys

### 2.4 Performance Tests

**Purpose**: Validate system under load
**Scope**: Production-like environment
**Tools**: k6, Locust, Artillery
**Frequency**: Weekly, before major releases
**Targets**: 1000 req/min sustained

### 2.5 OCR Accuracy Tests

**Purpose**: Validate text extraction accuracy
**Scope**: OCR service with test image library
**Tools**: Custom test harness, Levenshtein distance
**Frequency**: Per engine update
**Targets**: CER < 2%, WER < 5%

### 2.6 STT Accuracy Tests

**Purpose**: Validate transcription accuracy
**Scope**: STT service with test audio library
**Tools**: Custom test harness, jiwer library
**Frequency**: Per engine update
**Targets**: WER < 5%, RTF < 0.5

## 3. Test Workflows

### 3.1 Workflow: Image + Text Query

```gherkin
Feature: Image and Text Query Processing

 Background:
 Given the system is running with all services healthy
 And the user is authenticated with valid API key

 Scenario: Successful image and text query
 Given the user uploads an image "diagram.png"
 And the user provides text "Explain this architecture diagram"
 When the user submits the query
 Then the system should accept the request with status 202
 And the system should store the image in object storage
 And the OCR service should extract text from the image
 And the SLM analysis engine should determine:
 | complexity | medium |
 | subject | computer_science |
 | reasoning | analytical |
 And the model router should select a vision-capable model
 And the response should be generated within 8 seconds
 And the response should contain an explanation of the diagram
 And the analysis metadata should be available in the response

 Scenario: Image with no extractable text
 Given the user uploads an image "abstract_art.jpg"
 And the user provides text "What do you see?"
 When the user submits the query
 Then the OCR service should return empty text
 And the system should proceed with image-only analysis
 And the response should describe the visual content

 Scenario: Invalid image format
 Given the user uploads a file "document.pdf" as image
 When the user submits the query
 Then the system should reject with status 415
 And the error should indicate "Unsupported image format"

 Scenario: Large image
 Given the user uploads an image "panorama.jpg" of size 25MB
 When the user submits the query
 Then the system should reject with status 413
 And the error should indicate "File exceeds maximum size"
```

### 3.2 Workflow: Voice Only Query

```gherkin
Feature: Voice Only Query Processing

 Scenario: Successful voice query
 Given the user uploads audio "question.mp3"
 When the user submits the query
 Then the system should accept the request with status 202
 And the STT service should transcribe the audio
 And the transcript should be "What is the capital of France?"
 And the SLM analysis should classify:
 | complexity | low |
 | subject | geography |
 | intent | factual_query |
 And the router should select a fast, cheap model
 And the response should be "Paris"
 And the response should be generated within 5 seconds

 Scenario: Noisy audio
 Given the user uploads audio "noisy_cafe.wav"
 When the user submits the query
 Then the STT service should attempt noise reduction
 And the transcript confidence should be > 0.70
 And the system should proceed with the transcribed text

 Scenario: Unsupported audio format
 Given the user uploads audio "recording.aiff"
 When the user submits the query
 Then the system should reject with status 415
```

### 3.3 Workflow: Model Routing

```gherkin
Feature: Intelligent Model Routing

 Scenario: Simple factual query
 Given the user sends text "What is 2+2?"
 When the system analyzes the query
 Then the complexity should be "low"
 And the reasoning should be "factual"
 And the router should select "gemini-flash" or "gpt-4o-mini"
 And the estimated cost should be < $0.001

 Scenario: Complex coding problem
 Given the user sends text with image "debug_this_code.png"
 And the text says "Why is this Python function failing?"
 When the system analyzes the query
 Then the complexity should be "high"
 And the subject should be "computer_science"
 And the reasoning should be "analytical"
 And the router should select "claude-3.5-sonnet" or "gpt-4o"
 And the model should support "vision" and "code"

 Scenario: Fallback when primary model unavailable
 Given the router selects "claude-3.5-sonnet"
 And OpenRouter returns 503 for Claude
 When the system attempts to generate a response
 Then the system should try the fallback model
 And the fallback should be "gpt-4o"
 And the response should be generated successfully
 And the routing log should indicate fallback was used

 Scenario: System instruction selection
 Given the user has configured "technical_analysis" profile
 And the profile has thinking_mode enabled
 And the query is a debugging question
 When the system processes the query
 Then the selected profile should be "technical_analysis"
 And the model should receive instructions with thinking_mode
 And the temperature should be 0.3
```

### 3.4 Workflow: OCR Testing

```gherkin
Feature: OCR Testing Framework

 Scenario: Run OCR test on printed document
 Given the user uploads test image "invoice.jpg"
 And the ground truth is "Invoice #12345\nTotal: $100.00"
 When the user runs OCR test with engines: tesseract, easyocr
 Then the system should process with both engines
 And the results should include:
 | engine | confidence | cer | wer |
 | tesseract | > 0.90 | < 0.02 | < 0.05 |
 | easyocr | > 0.85 | < 0.03 | < 0.05 |
 And the report should highlight the best engine

 Scenario: Run batch OCR test
 Given the user selects test suite "printed_documents"
 And the suite contains 50 images
 When the user runs batch test
 Then the system should process all images
 And the report should include aggregate metrics:
 | metric | threshold |
 | avg_cer | < 0.03 |
 | avg_wer | < 0.06 |
 | avg_time | < 2s |
```

### 3.5 Workflow: STT Testing

```gherkin
Feature: STT Testing Framework

 Scenario: Run STT test on clean audio
 Given the user uploads test audio "clean_speech.wav"
 And the ground truth is "The quick brown fox jumps over the lazy dog"
 When the user runs STT test with engines: whisper, deepgram
 Then the system should transcribe with both engines
 And the results should include:
 | engine | confidence | wer | rtf |
 | whisper | > 0.90 | < 0.05 | < 0.5 |
 | deepgram | > 0.85 | < 0.05 | < 0.3 |

 Scenario: Test with accented speech
 Given the user uploads audio "indian_accent.mp3"
 And the ground truth is available
 When the user runs STT test
 Then the WER should be < 0.12
 And the system should detect language as "en"
```

## 4. Test Automation

### 4.1 CI Pipeline Tests

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
 unit-tests:
 runs-on: ubuntu-latest
 strategy:
 matrix:
 service: [gateway, input-processor, ocr-service, stt-service, analysis-engine, router-service]
 steps:
 - uses: actions/checkout@v4
 - name: Test ${{ matrix.service }}
 run: |
 cd services/${{ matrix.service }}
 make test
 - name: Upload coverage
 uses: codecov/codecov-action@v3

 integration-tests:
 needs: unit-tests
 runs-on: ubuntu-latest
 services:
 postgres:
 image: postgres:16
 env:
 POSTGRES_PASSWORD: test
 redis:
 image: redis:7
 minio:
 image: minio/minio
 steps:
 - uses: actions/checkout@v4
 - name: Integration Tests
 run: make test-integration

 e2e-tests:
 needs: integration-tests
 runs-on: ubuntu-latest
 steps:
 - uses: actions/checkout@v4
 - name: E2E Tests
 run: make test-e2e

 ocr-accuracy:
 needs: unit-tests
 runs-on: ubuntu-latest
 steps:
 - uses: actions/checkout@v4
 - name: OCR Accuracy Tests
 run: make test-ocr
 - name: Upload OCR Report
 uses: actions/upload-artifact@v4
 with:
 name: ocr-report
 path: reports/ocr/

 stt-accuracy:
 needs: unit-tests
 runs-on: ubuntu-latest
 steps:
 - uses: actions/checkout@v4
 - name: STT Accuracy Tests
 run: make test-stt
 - name: Upload STT Report
 uses: actions/upload-artifact@v4
 with:
 name: stt-report
 path: reports/stt/

 performance-tests:
 needs: [integration-tests, e2e-tests]
 runs-on: ubuntu-latest
 steps:
 - uses: actions/checkout@v4
 - name: Performance Tests
 run: make test-performance
```

### 4.2 Test Data Management

```
tests/fixtures/
├── images/
│ ├── printed/
│ │ ├── clean/
│ │ ├── noisy/
│ │ └── low_res/
│ ├── handwritten/
│ │ ├── neat/
│ │ └── cursive/
│ └── screenshots/
│ ├── code/
│ └── ui/
├── audio/
│ ├── clean/
│ │ ├── male/
│ │ └── female/
│ ├── noisy/
│ │ ├── music/
│ │ └── crowd/
│ └── accented/
│ ├── indian/
│ ├── chinese/
│ └── spanish/
└── text/
 ├── simple_queries.json
 ├── complex_queries.json
 └── code_snippets.json
```

## 5. Test Reports

### 5.1 OCR Test Report Format

```json
{
 "report_id": "rpt-123",
 "generated_at": "2026-07-12T20:00:00Z",
 "summary": {
 "total_images": 1000,
 "engines_tested": ["tesseract", "easyocr", "paddleocr"],
 "best_engine": "tesseract",
 "overall_cer": 0.018,
 "overall_wer": 0.042
 },
 "by_category": {
 "printed_clean": {
 "tesseract": {"cer": 0.01, "wer": 0.02, "avg_time_ms": 450},
 "easyocr": {"cer": 0.015, "wer": 0.03, "avg_time_ms": 800}
 },
 "handwritten": {
 "tesseract": {"cer": 0.08, "wer": 0.12, "avg_time_ms": 600},
 "easyocr": {"cer": 0.05, "wer": 0.08, "avg_time_ms": 900}
 }
 },
 "visualizations": {
 "accuracy_chart": "base64_png",
 "time_chart": "base64_png",
 "error_heatmap": "base64_png"
 }
}
```

### 5.2 STT Test Report Format

```json
{
 "report_id": "rpt-456",
 "generated_at": "2026-07-12T20:00:00Z",
 "summary": {
 "total_samples": 500,
 "engines_tested": ["whisper", "deepgram"],
 "best_engine": "whisper",
 "overall_wer": 0.045,
 "overall_rtf": 0.35
 },
 "by_category": {
 "clean_speech": {
 "whisper": {"wer": 0.03, "rtf": 0.4, "avg_time_ms": 1200},
 "deepgram": {"wer": 0.035, "rtf": 0.2, "avg_time_ms": 600}
 }
 }
}
```

## 6. Manual Testing Checklist

### 6.1 Pre-Release Checklist

- [ ] All 5 input modalities work end-to-end
- [ ] OCR accuracy meets thresholds on test suite
- [ ] STT accuracy meets thresholds on test suite
- [ ] Model routing selects appropriate models
- [ ] Fallback mechanisms work correctly
- [ ] System instruction profiles apply correctly
- [ ] Rate limiting works as expected
- [ ] Authentication and authorization function
- [ ] WebSocket streaming works
- [ ] Analytics dashboards show correct data
- [ ] Error handling provides useful messages
- [ ] Performance meets targets under load
- [ ] Security scan shows no critical vulnerabilities
- [ ] Backup and restore procedures tested

### 6.2 Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | Latest | Required |
| Firefox | Latest | Required |
| Safari | Latest | Required |
| Edge | Latest | Required |
| Mobile Chrome | Latest | Required |
| Mobile Safari | Latest | Required |

---
*Version: 1.0 | Date: 2026-07-12*
