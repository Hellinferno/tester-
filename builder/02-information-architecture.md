# Information Architecture

## 1. Data Taxonomy

### 1.1 Input Types
```
Input
├── MediaInput
│ ├── ImageInput
│ │ ├── RawImage (binary)
│ │ ├── ImageMetadata (dimensions, format, size)
│ │ └── PreprocessedImage (resized, normalized)
│ └── VoiceInput
│ ├── RawAudio (binary)
│ ├── AudioMetadata (duration, sample_rate, format)
│ └── PreprocessedAudio (noise_reduced, normalized)
├── TextInput
│ ├── RawText (string)
│ ├── TextMetadata (language, length, tokens)
│ └── EnhancedText (spell_corrected, expanded)
└── CompositeInput
 ├── ImageTextPair
 ├── ImageVoicePair
 └── (future: VideoTextPair)
```

### 1.2 Analysis Artifacts
```
AnalysisResult
├── ComplexityAnalysis
│ ├── level: Enum [LOW, MEDIUM, HIGH, CRITICAL]
│ ├── score: Float (0-1)
│ └── reasoning: String
├── ReasoningAnalysis
│ ├── type: Enum [FACTUAL, ANALYTICAL, CREATIVE, MULTI_STEP, COMPARATIVE]
│ ├── steps_required: Integer
│ └── chain_of_thought_needed: Boolean
├── SubjectClassification
│ ├── primary_subject: String
│ ├── confidence: Float
│ ├── subcategories: Array[String]
│ └── domain_tags: Array[String]
├── IntentExtraction
│ ├── primary_intent: String
│ ├── secondary_intents: Array[String]
│ ├── entities: Array[Entity]
│ └── query_reformulation: String
└── OutputRequirements
 ├── format: Enum [TEXT, JSON, MARKDOWN, CODE, IMAGE]
 ├── length_estimate: String [SHORT, MEDIUM, LONG]
 └── special_requirements: Array[String]
```

### 1.3 Model Routing Data
```
RoutingDecision
├── selected_model: String
├── provider: String (openrouter)
├── model_id: String
├── confidence: Float
├── estimated_cost: Float
├── estimated_latency: Integer (ms)
├── fallback_chain: Array[ModelOption]
├── reasoning: String
└── system_instruction_profile: SystemInstructionProfile
```

### 1.4 System Instruction Profiles
```
SystemInstructionProfile
├── id: UUID
├── title: String
├── instructions: String
├── configuration
│ ├── temperature: Float (0-2)
│ ├── thinking_mode: Boolean
│ ├── thinking_budget: Integer (tokens)
│ ├── structured_outputs: Boolean
│ ├── code_execution: Boolean
│ ├── function_calling: Boolean
│ ├── grounding_google_search: Boolean
│ ├── grounding_google_maps: Boolean
│ └── url_context: Boolean
├── applicable_modalities: Array[Enum]
├── applicable_subjects: Array[String]
├── created_at: Timestamp
└── updated_at: Timestamp
```

## 2. Information Flow

### 2.1 Request Lifecycle
```
[Client] → [Gateway] → [Input Processor] → [Media Extractor] → [SLM Analyzer] → [Model Router] → [Response Generator] → [Client]
 ↓ ↓ ↓ ↓ ↓
 [Auth/Rate] [Validator] [OCR/STT] [Complexity] [OpenRouter]
```

### 2.2 Data Flow by Modality

#### Image + Text
1. Client uploads image + text
2. Gateway validates and routes
3. Image stored in Object Storage
4. OCR engine extracts text from image (async)
5. Text inputs merged with OCR results
6. SLM Analyzer processes combined context
7. Router selects model based on analysis
8. Response generated and returned

#### Image + Voice
1. Client uploads image + voice
2. Voice stored, STT engine transcribes (async)
3. Image processed by OCR if needed
4. Combined text + image context sent to SLM
5. Router determines model
6. Response generated

#### Image Only
1. Image uploaded
2. Visual analysis performed
3. SLM generates description/analysis
4. Router selects vision-capable model
5. Response generated

#### Voice Only
1. Voice uploaded
2. STT transcribes to text
3. Text analyzed for intent/complexity
4. Router selects audio-optimized model
5. Response generated (text or TTS)

#### Text Only
1. Text received
2. Direct SLM analysis
3. Router selects model
4. Response generated

## 3. Content Organization

### 3.1 Database Collections
- `requests`: Incoming request metadata
- `media_files`: Stored media references
- `ocr_results`: OCR extraction results
- `stt_results`: Transcription results
- `analysis_results`: SLM analysis outputs
- `routing_decisions`: Model selection logs
- `responses`: Generated responses
- `system_instructions`: Instruction profiles
- `model_configs`: Available model configurations
- `test_results`: OCR/STT test metrics

### 3.2 Cache Strategy
- **L1**: Request context (Redis, 5 min TTL)
- **L2**: Analysis results (Redis, 1 hour TTL)
- **L3**: Model responses (Redis, 24 hour TTL for identical queries)
- **L4**: Media embeddings (Vector DB, persistent)

## 4. Metadata Schema

### 4.1 Request Metadata
```json
{
 "request_id": "uuid",
 "session_id": "uuid",
 "user_id": "uuid",
 "timestamp": "ISO8601",
 "modality": "image_text|image_voice|image_only|voice_only|text_only",
 "input_hashes": {
 "image": "sha256",
 "voice": "sha256",
 "text": "sha256"
 },
 "client_info": {
 "platform": "web|ios|android",
 "version": "string"
 }
}
```

### 4.2 Analysis Metadata
```json
{
 "analysis_id": "uuid",
 "request_id": "uuid",
 "complexity": {
 "level": "low|medium|high|critical",
 "score": 0.85,
 "factors": ["mathematical", "multi-step"]
 },
 "subject": {
 "primary": "mathematics",
 "confidence": 0.92,
 "subcategories": ["algebra", "equations"]
 },
 "reasoning": {
 "type": "multi_step",
 "estimated_steps": 5,
 "requires_cot": true
 }
}
```

## 5. Search & Retrieval

### 5.1 Query Patterns
- Exact match by request_id
- Session history retrieval
- Model performance filtering
- Subject-based analytics
- Complexity distribution queries

### 5.2 Indexing Strategy
- B-tree: request_id, session_id, user_id, timestamp
- GIN: subject_tags, modality, complexity_level
- Vector: semantic embeddings for similar query matching

---
*Version: 1.0 | Date: 2026-07-12*
