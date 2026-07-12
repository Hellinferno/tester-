# API Contracts

## 1. Base URL & Authentication
```
Base URL: https://api.slm-router.io/v1
Authentication: Bearer {API_KEY} or X-API-Key: {API_KEY}
Content-Type: application/json (for text)
Content-Type: multipart/form-data (for media uploads)
```

## 2. Endpoints

### 2.1 Submit Query (Multi-Modal)

**POST** `/queries`

Submit a multi-modal query to the system.

#### Request
```http
POST /v1/queries HTTP/1.1
Host: api.slm-router.io
Authorization: Bearer {api_key}
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="modality"

image_text

------WebKitFormBoundary
Content-Disposition: form-data; name="text"

What is shown in this image and what does the text say?

------WebKitFormBoundary
Content-Disposition: form-data; name="image"; filename="photo.jpg"
Content-Type: image/jpeg

<binary data>
------WebKitFormBoundary
Content-Disposition: form-data; name="system_instruction_profile_id"

550e8400-e29b-41d4-a716-446655440000

------WebKitFormBoundary
Content-Disposition: form-data; name="options"

{"stream": true, "max_tokens": 4096}
------WebKitFormBoundary--
```

#### Request Schema (OpenAPI)
```yaml
paths:
 /queries:
 post:
 summary: Submit a multi-modal query
 requestBody:
 content:
 multipart/form-data:
 schema:
 type: object
 required: [modality]
 properties:
 modality:
 type: string
 enum: [image_text, image_voice, image_only, voice_only, text_only]
 text:
 type: string
 maxLength: 32000
 description: Text input (required for text-containing modalities)
 image:
 type: string
 format: binary
 description: Image file (required for image-containing modalities)
 voice:
 type: string
 format: binary
 description: Audio file (required for voice-containing modalities)
 system_instruction_profile_id:
 type: string
 format: uuid
 description: Optional specific instruction profile
 options:
 type: object
 properties:
 stream:
 type: boolean
 default: false
 max_tokens:
 type: integer
 default: 4096
 temperature:
 type: number
 minimum: 0
 maximum: 2
 return_analysis:
 type: boolean
 default: false
 return_routing_info:
 type: boolean
 default: false
```

#### Response (202 Accepted - Async Processing)
```json
{
 "request_id": "550e8400-e29b-41d4-a716-446655440000",
 "status": "accepted",
 "modality": "image_text",
 "estimated_processing_time_ms": 3500,
 "status_url": "https://api.slm-router.io/v1/queries/550e8400-e29b-41d4-a716-446655440000/status",
 "result_url": "https://api.slm-router.io/v1/queries/550e8400-e29b-41d4-a716-446655440000/result",
 "websocket_url": "wss://api.slm-router.io/v1/stream/550e8400-e29b-41d4-a716-446655440000",
 "expires_at": "2026-07-12T21:27:00Z"
}
```

#### Response (200 OK - Streaming)
```json
{
 "request_id": "550e8400-e29b-41d4-a716-446655440000",
 "status": "streaming",
 "modality": "image_text",
 "analysis": {
 "complexity": {
 "level": "medium",
 "score": 0.65
 },
 "subject": {
 "primary": "computer_science",
 "confidence": 0.88
 },
 "reasoning": {
 "type": "analytical",
 "estimated_steps": 3
 },
 "routing": {
 "selected_model": "anthropic/claude-3.5-sonnet",
 "confidence": 0.92,
 "estimated_cost": 0.0024
 }
 },
 "response": {
 "content": "The image shows...",
 "content_type": "text/markdown",
 "tokens_used": 245,
 "finish_reason": "stop"
 }
}
```

### 2.2 Get Query Status

**GET** `/queries/{request_id}/status`

#### Response
```json
{
 "request_id": "550e8400-e29b-41d4-a716-446655440000",
 "status": "analyzing",
 "modality": "image_text",
 "progress": {
 "input_validated": true,
 "ocr_completed": true,
 "stt_completed": false,
 "analysis_completed": false,
 "routing_completed": false,
 "response_generated": false
 },
 "current_stage": "slm_analysis",
 "estimated_remaining_ms": 1200,
 "started_at": "2026-07-12T20:27:00Z",
 "updated_at": "2026-07-12T20:27:02Z"
}
```

### 2.3 Get Query Result

**GET** `/queries/{request_id}/result`

#### Response
```json
{
 "request_id": "550e8400-e29b-41d4-a716-446655440000",
 "status": "completed",
 "modality": "image_text",
 "input": {
 "text": "What is shown in this image?",
 "image_id": "660e8400-e29b-41d4-a716-446655440001"
 },
 "processing": {
 "ocr": {
 "extracted_text": "Error: Stack overflow...",
 "confidence": 0.94,
 "engine": "tesseract"
 },
 "analysis": {
 "complexity": "medium",
 "subject": "computer_science",
 "reasoning": "analytical",
 "intent": "debug_explanation"
 },
 "routing": {
 "selected_model": "anthropic/claude-3.5-sonnet",
 "fallback_used": false,
 "latency_ms": 2800
 }
 },
 "response": {
 "content": "The image shows a stack overflow error...",
 "content_type": "text/markdown",
 "tokens_used": 312,
 "tokens_input": 145,
 "tokens_output": 167,
 "finish_reason": "stop",
 "generated_at": "2026-07-12T20:27:05Z"
 },
 "cost": {
 "total_usd": 0.0028,
 "model_cost": 0.0024,
 "processing_cost": 0.0004
 },
 "metadata": {
 "system_instruction_profile": "technical_analysis",
 "temperature": 0.7,
 "thinking_mode": true
 }
}
```

### 2.4 OCR Testing

**POST** `/tests/ocr`

Submit an image for OCR testing with ground truth.

#### Request
```json
{
 "image": "<binary>",
 "ground_truth": "Expected text output",
 "options": {
 "engines": ["tesseract", "easyocr", "paddleocr"],
 "language": "eng",
 "return_bounding_boxes": true,
 "preprocessing": {
 "denoise": true,
 "deskew": true,
 "contrast_enhance": true
 }
 }
}
```

#### Response
```json
{
 "test_id": "770e8400-e29b-41d4-a716-446655440000",
 "status": "completed",
 "results": [
 {
 "engine": "tesseract",
 "extracted_text": "Actual text output",
 "confidence": 0.95,
 "metrics": {
 "character_accuracy": 0.98,
 "word_accuracy": 0.96,
 "cer": 0.02,
 "wer": 0.04
 },
 "bounding_boxes": [
 {"text": "Actual", "bbox": [10, 20, 50, 40], "conf": 0.97}
 ],
 "processing_time_ms": 450
 }
 ],
 "comparison": {
 "best_engine": "tesseract",
 "best_wer": 0.04,
 "best_cer": 0.02
 }
}
```

### 2.5 STT Testing

**POST** `/tests/stt`

Submit audio for STT testing with ground truth.

#### Request
```json
{
 "audio": "<binary>",
 "ground_truth": "Expected transcript",
 "options": {
 "engines": ["whisper", "deepgram"],
 "language": "en",
 "return_word_timestamps": true,
 "return_speaker_labels": false
 }
}
```

#### Response
```json
{
 "test_id": "880e8400-e29b-41d4-a716-446655440000",
 "status": "completed",
 "results": [
 {
 "engine": "whisper",
 "transcript": "Actual transcript",
 "confidence": 0.92,
 "metrics": {
 "wer": 0.05,
 "mer": 0.03,
 "wil": 0.04
 },
 "words": [
 {"word": "Actual", "start": 0.5, "end": 0.8, "conf": 0.95}
 ],
 "processing_time_ms": 1200
 }
 ],
 "comparison": {
 "best_engine": "whisper",
 "best_wer": 0.05
 }
}
```

### 2.6 System Instruction Profiles

**GET** `/system-instructions`

List all system instruction profiles.

#### Response
```json
{
 "profiles": [
 {
 "id": "550e8400-e29b-41d4-a716-446655440000",
 "title": "Technical Analysis",
 "instructions": "You are a technical analyst...",
 "configuration": {
 "temperature": 0.3,
 "thinking_mode": true,
 "thinking_budget": 4000,
 "structured_outputs": true,
 "code_execution": true,
 "function_calling": false,
 "grounding_google_search": true,
 "grounding_google_maps": false,
 "url_context": true
 },
 "applicable_modalities": ["image_text", "text_only"],
 "applicable_subjects": ["computer_science", "mathematics"],
 "is_default": false,
 "is_active": true
 }
 ],
 "total": 12,
 "page": 1,
 "per_page": 20
}
```

**POST** `/system-instructions`

Create a new system instruction profile.

#### Request
```json
{
 "title": "Creative Writing",
 "instructions": "You are a creative writing assistant...",
 "configuration": {
 "temperature": 1.2,
 "thinking_mode": false,
 "structured_outputs": false,
 "code_execution": false,
 "function_calling": false,
 "grounding_google_search": false,
 "grounding_google_maps": false,
 "url_context": false
 },
 "applicable_modalities": ["text_only", "voice_only"],
 "applicable_subjects": ["literature", "creative_writing"],
 "applicable_complexity_levels": ["low", "medium"]
}
```

**PUT** `/system-instructions/{id}`

Update an existing profile.

**DELETE** `/system-instructions/{id}`

Delete a profile (cannot delete if in use).

### 2.7 Model Configuration

**GET** `/models`

List available models and their configurations.

#### Response
```json
{
 "models": [
 {
 "model_id": "anthropic/claude-3.5-sonnet",
 "provider": "openrouter",
 "display_name": "Claude 3.5 Sonnet",
 "capabilities": ["vision", "code", "reasoning", "multilingual"],
 "max_tokens": 8192,
 "context_window": 200000,
 "cost_per_1k_input": 0.003,
 "cost_per_1k_output": 0.015,
 "average_latency_ms": 2500,
 "is_active": true,
 "is_fallback": false
 }
 ]
}
```

### 2.8 Analytics

**GET** `/analytics/performance`

Get system performance metrics.

#### Query Parameters
- `start_date`: ISO 8601 date
- `end_date`: ISO 8601 date
- `modality`: Filter by modality
- `model_id`: Filter by model

#### Response
```json
{
 "period": {
 "start": "2026-07-01T00:00:00Z",
 "end": "2026-07-12T23:59:59Z"
 },
 "summary": {
 "total_requests": 15420,
 "average_latency_ms": 3200,
 "total_cost_usd": 45.23,
 "routing_accuracy": 0.94
 },
 "by_modality": {
 "image_text": {"requests": 5230, "avg_latency_ms": 4500},
 "text_only": {"requests": 8910, "avg_latency_ms": 1200}
 },
 "by_model": {
 "anthropic/claude-3.5-sonnet": {"requests": 8200, "avg_cost": 0.003}
 },
 "by_complexity": {
 "low": {"requests": 8000, "avg_latency_ms": 1500},
 "high": {"requests": 1200, "avg_latency_ms": 6500}
 }
}
```

## 3. WebSocket Streaming

### 3.1 Connection
```
wss://api.slm-router.io/v1/stream/{request_id}
Headers: Authorization: Bearer {api_key}
```

### 3.2 Events

#### Server → Client
```json
// Status update
{"event": "status", "data": {"stage": "ocr_processing", "progress": 45}}

// Analysis complete
{"event": "analysis", "data": {"complexity": "high", "subject": "mathematics"}}

// Routing decision
{"event": "routing", "data": {"model": "openai/gpt-4o", "confidence": 0.95}}

// Response chunk (streaming)
{"event": "chunk", "data": {"content": "The solution is...", "index": 0}}

// Completion
{"event": "complete", "data": {"tokens_used": 245, "finish_reason": "stop"}}

// Error
{"event": "error", "data": {"code": "MODEL_TIMEOUT", "message": "..."}}
```

#### Client → Server
```json
// Cancel request
{"event": "cancel", "data": {"reason": "user_cancelled"}}

// Update preferences
{"event": "config", "data": {"temperature": 0.5}}
```

## 4. Error Handling

### 4.1 Error Codes
```json
{
 "INVALID_MODALITY": {"status": 400, "message": "Invalid modality specified"},
 "MISSING_MEDIA": {"status": 400, "message": "Required media not provided"},
 "FILE_TOO_LARGE": {"status": 413, "message": "File exceeds maximum size"},
 "UNSUPPORTED_FORMAT": {"status": 415, "message": "Unsupported file format"},
 "RATE_LIMIT_EXCEEDED": {"status": 429, "message": "Rate limit exceeded"},
 "MODEL_UNAVAILABLE": {"status": 503, "message": "Selected model unavailable"},
 "OCR_FAILED": {"status": 422, "message": "OCR processing failed"},
 "STT_FAILED": {"status": 422, "message": "STT processing failed"},
 "ROUTING_ERROR": {"status": 500, "message": "Model routing failed"},
 "OPENROUTER_ERROR": {"status": 502, "message": "Upstream provider error"}
}
```

### 4.2 Error Response Format
```json
{
 "error": {
 "code": "MODEL_UNAVAILABLE",
 "message": "Selected model anthropic/claude-3.5-sonnet is currently unavailable",
 "details": {
 "fallback_model": "openai/gpt-4o",
 "retry_after": 30
 },
 "request_id": "550e8400-e29b-41d4-a716-446655440000",
 "timestamp": "2026-07-12T20:27:00Z"
 }
}
```

## 5. Rate Limiting Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1626120000
X-RateLimit-Retry-After: 45
```

---
*Version: 1.0 | Date: 2026-07-12*
