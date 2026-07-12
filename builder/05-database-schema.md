# Database Schema

## 1. PostgreSQL Schema

### 1.1 Users & Authentication
```sql
CREATE TABLE users (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 email VARCHAR(255) UNIQUE NOT NULL,
 password_hash VARCHAR(255) NOT NULL,
 display_name VARCHAR(100),
 role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'developer')),
 tier VARCHAR(20) DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
 api_key VARCHAR(64) UNIQUE,
 api_secret_hash VARCHAR(255),
 rate_limit_per_minute INTEGER DEFAULT 100,
 created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 last_login_at TIMESTAMP WITH TIME ZONE,
 is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE sessions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID REFERENCES users(id) ON DELETE CASCADE,
 token VARCHAR(255) UNIQUE NOT NULL,
 expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
 ip_address INET,
 user_agent TEXT,
 created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 1.2 Requests & Media
```sql
CREATE TABLE requests (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 session_id UUID,
 user_id UUID REFERENCES users(id) ON DELETE SET NULL,
 modality VARCHAR(30) NOT NULL CHECK (modality IN (
 'image_text', 'image_voice', 'image_only', 'voice_only', 'text_only'
 )),
 status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
 'pending', 'processing', 'analyzing', 'routing', 'generating', 'completed', 'failed'
 )),
 input_text TEXT,
 input_text_hash VARCHAR(64),
 has_image BOOLEAN DEFAULT FALSE,
 has_voice BOOLEAN DEFAULT FALSE,
 image_id UUID,
 voice_id UUID,
 estimated_complexity VARCHAR(20),
 selected_model VARCHAR(100),
 response_id UUID,
 latency_ms INTEGER,
 cost_usd DECIMAL(10, 6),
 error_message TEXT,
 metadata JSONB DEFAULT '{}',
 created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE media_files (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
 user_id UUID REFERENCES users(id) ON DELETE SET NULL,
 media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('image', 'voice')),
 original_filename VARCHAR(255),
 storage_key VARCHAR(500) NOT NULL,
 file_size_bytes BIGINT,
 mime_type VARCHAR(50),
 width INTEGER, -- for images
 height INTEGER, -- for images
 duration_seconds DECIMAL(10, 2), -- for audio
 sample_rate INTEGER, -- for audio
 checksum VARCHAR(64),
 created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add FK constraints after table creation
ALTER TABLE requests ADD CONSTRAINT fk_image 
 FOREIGN KEY (image_id) REFERENCES media_files(id);
ALTER TABLE requests ADD CONSTRAINT fk_voice 
 FOREIGN KEY (voice_id) REFERENCES media_files(id);
```

### 1.3 OCR & STT Results
```sql
CREATE TABLE ocr_results (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
 media_id UUID REFERENCES media_files(id) ON DELETE CASCADE,
 extracted_text TEXT,
 confidence_score DECIMAL(5, 4), -- 0.0000 to 1.0000
 language_detected VARCHAR(10),
 processing_time_ms INTEGER,
 engine_used VARCHAR(50), -- 'tesseract', 'easyocr', 'paddleocr'
 word_count INTEGER,
 bounding_boxes JSONB, -- [{"text": "...", "bbox": [x1,y1,x2,y2], "conf": 0.98}]
 raw_result JSONB,
 created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE stt_results (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
 media_id UUID REFERENCES media_files(id) ON DELETE CASCADE,
 transcript TEXT,
 confidence_score DECIMAL(5, 4),
 language_detected VARCHAR(10),
 processing_time_ms INTEGER,
 engine_used VARCHAR(50), -- 'whisper', 'deepgram'
 word_count INTEGER,
 words JSONB, -- [{"word": "...", "start": 0.5, "end": 0.8, "conf": 0.99}]
 speaker_labels JSONB, -- for diarization
 raw_result JSONB,
 created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 1.4 Analysis Results
```sql
CREATE TABLE analysis_results (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
 complexity_level VARCHAR(20) CHECK (complexity_level IN ('low', 'medium', 'high', 'critical')),
 complexity_score DECIMAL(5, 4),
 complexity_reasoning TEXT,
 reasoning_type VARCHAR(50) CHECK (reasoning_type IN (
 'factual', 'analytical', 'creative', 'multi_step', 'comparative', 'synthetic'
 )),
 estimated_steps INTEGER,
 requires_chain_of_thought BOOLEAN DEFAULT FALSE,
 primary_subject VARCHAR(100),
 subject_confidence DECIMAL(5, 4),
 subject_subcategories TEXT[], -- PostgreSQL array
 domain_tags TEXT[],
 primary_intent VARCHAR(100),
 secondary_intents TEXT[],
 entities JSONB, -- [{"type": "person", "value": "..."}]
 query_reformulation TEXT,
 output_format VARCHAR(20) CHECK (output_format IN ('text', 'json', 'markdown', 'code', 'image')),
 estimated_length VARCHAR(20) CHECK (estimated_length IN ('short', 'medium', 'long')),
 special_requirements TEXT[],
 system_instruction_profile_id UUID,
 analysis_time_ms INTEGER,
 raw_analysis JSONB,
 created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 1.5 Routing & Models
```sql
CREATE TABLE model_configs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 model_id VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'openai/gpt-4o', 'anthropic/claude-3.5-sonnet'
 provider VARCHAR(50) NOT NULL,
 display_name VARCHAR(100),
 description TEXT,
 capabilities TEXT[], -- ['vision', 'code', 'reasoning', 'multilingual']
 max_tokens INTEGER,
 context_window INTEGER,
 cost_per_1k_input DECIMAL(10, 6),
 cost_per_1k_output DECIMAL(10, 6),
 average_latency_ms INTEGER,
 is_active BOOLEAN DEFAULT TRUE,
 is_fallback BOOLEAN DEFAULT FALSE,
 priority INTEGER DEFAULT 0,
 metadata JSONB DEFAULT '{}',
 created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE routing_decisions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
 analysis_id UUID REFERENCES analysis_results(id) ON DELETE SET NULL,
 selected_model_id VARCHAR(100) NOT NULL,
 provider VARCHAR(50) NOT NULL,
 confidence DECIMAL(5, 4),
 estimated_cost DECIMAL(10, 6),
 estimated_latency_ms INTEGER,
 actual_cost DECIMAL(10, 6),
 actual_latency_ms INTEGER,
 fallback_used BOOLEAN DEFAULT FALSE,
 fallback_chain JSONB, -- ordered list of attempted models
 routing_reason TEXT,
 system_instruction_profile_id UUID,
 created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE responses (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
 routing_id UUID REFERENCES routing_decisions(id) ON DELETE SET NULL,
 content TEXT,
 content_type VARCHAR(30) DEFAULT 'text/markdown',
 tokens_used INTEGER,
 tokens_input INTEGER,
 tokens_output INTEGER,
 finish_reason VARCHAR(20), -- 'stop', 'length', 'error'
 generation_time_ms INTEGER,
 raw_response JSONB,
 created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 1.6 System Instructions
```sql
CREATE TABLE system_instruction_profiles (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 title VARCHAR(200) NOT NULL,
 instructions TEXT NOT NULL,
 temperature DECIMAL(3, 2) DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
 thinking_mode BOOLEAN DEFAULT FALSE,
 thinking_budget INTEGER DEFAULT 0,
 structured_outputs BOOLEAN DEFAULT FALSE,
 code_execution BOOLEAN DEFAULT FALSE,
 function_calling BOOLEAN DEFAULT FALSE,
 grounding_google_search BOOLEAN DEFAULT FALSE,
 grounding_google_maps BOOLEAN DEFAULT FALSE,
 url_context BOOLEAN DEFAULT FALSE,
 applicable_modalities TEXT[],
 applicable_subjects TEXT[],
 applicable_complexity_levels TEXT[],
 is_default BOOLEAN DEFAULT FALSE,
 is_active BOOLEAN DEFAULT TRUE,
 priority INTEGER DEFAULT 0,
 created_by UUID REFERENCES users(id),
 created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Link analysis to instruction profiles
ALTER TABLE analysis_results ADD CONSTRAINT fk_instruction_profile
 FOREIGN KEY (system_instruction_profile_id) REFERENCES system_instruction_profiles(id);
ALTER TABLE routing_decisions ADD CONSTRAINT fk_instruction_profile
 FOREIGN KEY (system_instruction_profile_id) REFERENCES system_instruction_profiles(id);
```

### 1.7 Testing & Metrics
```sql
CREATE TABLE ocr_test_results (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 test_name VARCHAR(200),
 image_id UUID REFERENCES media_files(id),
 ground_truth TEXT,
 extracted_text TEXT,
 character_accuracy DECIMAL(5, 4),
 word_accuracy DECIMAL(5, 4),
 wer DECIMAL(5, 4), -- Word Error Rate
 cer DECIMAL(5, 4), -- Character Error Rate
 engine_used VARCHAR(50),
 language VARCHAR(10),
 image_type VARCHAR(20), -- 'printed', 'handwritten', 'screenshot'
 noise_level VARCHAR(20), -- 'clean', 'moderate', 'heavy'
 metadata JSONB,
 created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE stt_test_results (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 test_name VARCHAR(200),
 audio_id UUID REFERENCES media_files(id),
 ground_truth TEXT,
 transcript TEXT,
 wer DECIMAL(5, 4),
 mer DECIMAL(5, 4), -- Match Error Rate
 wil DECIMAL(5, 4), -- Word Information Lost
 engine_used VARCHAR(50),
 language VARCHAR(10),
 audio_type VARCHAR(20), -- 'clean', 'noisy', 'accented'
 duration_seconds DECIMAL(10, 2),
 metadata JSONB,
 created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE model_performance_logs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 model_id VARCHAR(100) REFERENCES model_configs(model_id),
 request_id UUID REFERENCES requests(id),
 analysis_id UUID REFERENCES analysis_results(id),
 complexity_level VARCHAR(20),
 subject VARCHAR(100),
 modality VARCHAR(30),
 latency_ms INTEGER,
 cost_usd DECIMAL(10, 6),
 tokens_input INTEGER,
 tokens_output INTEGER,
 user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
 was_correct_routing BOOLEAN,
 created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 2. Indexes

```sql
-- Performance indexes
CREATE INDEX idx_requests_user_id ON requests(user_id);
CREATE INDEX idx_requests_session_id ON requests(session_id);
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_modality ON requests(modality);
CREATE INDEX idx_requests_created_at ON requests(created_at DESC);
CREATE INDEX idx_requests_complexity ON requests(estimated_complexity);

CREATE INDEX idx_media_request_id ON media_files(request_id);
CREATE INDEX idx_media_user_id ON media_files(user_id);
CREATE INDEX idx_media_type ON media_files(media_type);

CREATE INDEX idx_ocr_request_id ON ocr_results(request_id);
CREATE INDEX idx_ocr_media_id ON ocr_results(media_id);
CREATE INDEX idx_ocr_confidence ON ocr_results(confidence_score);

CREATE INDEX idx_stt_request_id ON stt_results(request_id);
CREATE INDEX idx_stt_media_id ON stt_results(media_id);
CREATE INDEX idx_stt_confidence ON stt_results(confidence_score);

CREATE INDEX idx_analysis_request_id ON analysis_results(request_id);
CREATE INDEX idx_analysis_complexity ON analysis_results(complexity_level);
CREATE INDEX idx_analysis_subject ON analysis_results(primary_subject);
CREATE INDEX idx_analysis_instruction_profile ON analysis_results(system_instruction_profile_id);

CREATE INDEX idx_routing_request_id ON routing_decisions(request_id);
CREATE INDEX idx_routing_model ON routing_decisions(selected_model_id);
CREATE INDEX idx_routing_created_at ON routing_decisions(created_at DESC);

CREATE INDEX idx_responses_request_id ON responses(request_id);
CREATE INDEX idx_performance_model ON model_performance_logs(model_id);
CREATE INDEX idx_performance_created_at ON model_performance_logs(created_at DESC);

-- GIN indexes for JSONB
CREATE INDEX idx_ocr_bounding_boxes ON ocr_results USING GIN (bounding_boxes);
CREATE INDEX idx_analysis_entities ON analysis_results USING GIN (entities);
CREATE INDEX idx_analysis_raw ON analysis_results USING GIN (raw_analysis);
CREATE INDEX idx_requests_metadata ON requests USING GIN (metadata);

-- Full-text search
CREATE INDEX idx_ocr_text_search ON ocr_results USING GIN (to_tsvector('english', extracted_text));
CREATE INDEX idx_stt_transcript_search ON stt_results USING GIN (to_tsvector('english', transcript));
```

## 3. Redis Schema

### 3.1 Key Patterns
```
# Request context (TTL: 5 minutes)
req:{request_id}:context → Hash {user_id, modality, status, timestamp}

# Analysis cache (TTL: 1 hour)
analysis:{input_hash} → String (JSON)

# Model response cache (TTL: 24 hours)
response:{query_hash} → String (JSON)

# Rate limiting
rate_limit:{user_id} → Counter (TTL: 1 minute)
rate_limit:{api_key} → Counter (TTL: 1 minute)

# Session data
session:{session_id} → Hash {user_id, created_at, requests_count}

# Media processing status
media:{media_id}:status → String (pending|processing|completed|failed)
media:{media_id}:progress → Integer (0-100)

# Model availability
model:{model_id}:status → String (available|degraded|unavailable)
model:{model_id}:latency → Sorted Set (timestamp → latency_ms)

# System instruction profiles
sip:{profile_id} → String (JSON)
sip:default → String (profile_id)
```

## 4. MinIO/S3 Object Storage

```
Bucket: slm-router-media
├── uploads/
│ ├── {user_id}/
│ │ ├── images/
│ │ │ └── {media_id}.{ext}
│ │ └── audio/
│ │ └── {media_id}.{ext}
├── processed/
│ ├── ocr/
│ │ └── {media_id}_ocr.json
│ ├── stt/
│ │ └── {media_id}_stt.json
│ └── thumbnails/
│ └── {media_id}_thumb.jpg
└── exports/
 └── test-reports/
 └── {timestamp}_report.pdf
```

## 5. Vector Store (Pinecone/Milvus)

```
Index: query-embeddings
├── Dimension: 1536 (OpenAI text-embedding-3-small)
├── Metric: cosine
├── Namespaces:
│ ├── text-queries: Text-only queries
│ ├── image-queries: Image descriptions
│ ├── voice-queries: Transcript embeddings
│ └── composite: Multi-modal query embeddings
└── Metadata:
 ├── request_id
 ├── user_id
 ├── modality
 ├── complexity_level
 ├── subject
 ├── selected_model
 └── response_quality_score
```

---
*Version: 1.0 | Date: 2026-07-12*
