# Computation Engine Specification

## 1. Overview

The Computation Engine is the core intelligence of the SLM Router system. It consists of:
1. **SLM Analysis Engine**: Local small language model for query understanding
2. **OCR Engine**: Multi-engine text extraction from images
3. **STT Engine**: Multi-engine speech-to-text transcription
4. **Model Router**: Intelligent model selection algorithm

## 2. SLM Analysis Engine

### 2.1 Model Selection

| Model | Size | Use Case | RAM Required |
|-------|------|----------|---------------|
| Llama 3.1 8B Instruct | 8B | Primary analysis | 8GB RAM |
| Phi-4 | 14B | Complex reasoning | 16GB RAM |
| Gemma 2 2B | 2B | Edge deployment | 4GB RAM |
| Qwen2.5 7B | 7B | Multilingual | 8GB RAM |

### 2.2 Inference Framework

```yaml
Framework: OpenRouter API / llama.cpp (edge)
Configuration:
 num_cpu_threads: 1
 cpu_memory_utilization: 0.85
 max_model_len: 32768
 Model precision managed by OpenRouter
 batch_size: 16
 scheduling: continuous_batching
```

### 2.3 Analysis Pipeline

```python
class SLMAnalysisEngine:
 def analyze(self, request: CompositeRequest) -> AnalysisResult:
 # Stage 1: Context Assembly
 context = self.assemble_context(request)

 # Stage 2: Parallel Analysis (async)
 complexity_task = self.analyze_complexity(context)
 subject_task = self.classify_subject(context)
 reasoning_task = self.assess_reasoning(context)
 intent_task = self.extract_intent(context)

 # Stage 3: Aggregation
 results = await asyncio.gather(
 complexity_task, subject_task, reasoning_task, intent_task
 )

 # Stage 4: Output Prediction
 output_req = self.predict_output_requirements(results)

 # Stage 5: Instruction Profile Selection
 profile = self.select_instruction_profile(results, output_req)

 return AnalysisResult(
 complexity=results[0],
 subject=results[1],
 reasoning=results[2],
 intent=results[3],
 output_requirements=output_req,
 instruction_profile=profile
 )
```

### 2.4 Prompt Templates

#### Complexity Analysis Prompt
```
Analyze the following query and determine its complexity level.

Context: {{context}}

Rate the complexity on this scale:
- LOW: Simple factual recall, single-step answer
- MEDIUM: Requires some reasoning, 2-3 steps
- HIGH: Multi-step reasoning, domain expertise required
- CRITICAL: Deep analysis, synthesis, creative problem solving

Provide:
1. Complexity level (LOW/MEDIUM/HIGH/CRITICAL)
2. Confidence score (0.0-1.0)
3. Reasoning for the rating
4. Estimated number of reasoning steps
5. Whether chain-of-thought is beneficial

Respond in JSON format.
```

#### Subject Classification Prompt
```
Classify the primary subject domain of this query.

Context: {{context}}

Possible subjects: mathematics, computer_science, physics, chemistry, biology, 
medicine, law, finance, history, literature, general_knowledge, coding, 
art, music, engineering, data_science, philosophy, economics, other

Provide:
1. Primary subject
2. Confidence score (0.0-1.0)
3. Subcategories (up to 3)
4. Domain tags (up to 5)

Respond in JSON format.
```

#### Reasoning Assessment Prompt
```
Assess the type of reasoning required for this query.

Context: {{context}}

Reasoning types:
- FACTUAL: Direct knowledge retrieval
- ANALYTICAL: Break down and examine components
- CREATIVE: Generate novel ideas or content
- MULTI_STEP: Sequential problem solving
- COMPARATIVE: Compare/contrast multiple items
- SYNTHETIC: Combine information from multiple sources

Provide:
1. Primary reasoning type
2. Estimated steps required
3. Whether chain-of-thought improves accuracy
4. Key cognitive skills needed

Respond in JSON format.
```

#### Intent Extraction Prompt
```
Extract the user's intent and entities from this query.

Context: {{context}}

Provide:
1. Primary intent (e.g., "explain_concept", "debug_code", "summarize_text")
2. Secondary intents (if any)
3. Named entities with types
4. Reformulated query (clearer version)
5. Expected output format

Respond in JSON format.
```

### 2.5 Performance Requirements

| Metric | Target | Measurement |
|--------|--------|-------------|
| Analysis latency | < 3s | Time from input to analysis result (includes OpenRouter API call) |
| Throughput | 100 req/sec | Concurrent analysis requests |
| Accuracy (complexity) | > 90% | Human-labeled validation set |
| Accuracy (subject) | > 85% | Multi-label classification |
| Accuracy (intent) | > 88% | Intent classification benchmark |
| OpenRouter API reliability | > 99% | Uptime monitoring |

## 3. OCR Engine

### 3.1 Multi-Engine Architecture

```python
class OCREngine:
 def __init__(self):
 self.engines = {
 'tesseract': TesseractEngine(),
 'easyocr': EasyOCREngine(),
 'paddleocr': PaddleOCREngine()
 }
 self.default_engine = 'easyocr'

 async def extract(self, image: Image, config: OCRConfig) -> OCRResult:
 # Preprocess image
 processed = self.preprocess(image, config.preprocessing)

 # Run primary engine
 primary = self.engines[config.engine or self.default_engine]
 result = await primary.extract(processed)

 # If confidence low, try ensemble
 if result.confidence < 0.85 and config.use_ensemble:
 results = await asyncio.gather(*[
 engine.extract(processed) 
 for engine in self.engines.values()
 ])
 result = self.ensemble_vote(results)

 return result
```

### 3.2 Preprocessing Pipeline

```python
class ImagePreprocessor:
 def process(self, image: Image, config: PreprocessConfig) -> Image:
 steps = []

 if config.denoise:
 steps.append(self.denoise(image))

 if config.deskew:
 steps.append(self.deskew(image))

 if config.contrast_enhance:
 steps.append(self.enhance_contrast(image))

 if config.binarize:
 steps.append(self.binarize(image))

 if config.resize:
 steps.append(self.resize(image, config.max_dimension))

 return reduce(lambda img, step: step(img), steps, image)
```

### 3.3 Engine Specifications

| Engine | Best For | Languages | Speed | Accuracy |
|--------|----------|-----------|-------|----------|
| Tesseract | Printed text, documents | 100+ | Fast | Good |
| EasyOCR | Mixed content, handwriting | 80+ | Medium | Very Good |
| PaddleOCR | Chinese, tables, forms | 10+ | Medium | Excellent |

### 3.4 Output Format

```json
{
 "text": "Extracted full text",
 "confidence": 0.94,
 "language": "eng",
 "words": [
 {
 "text": "Hello",
 "bbox": [10, 20, 50, 40],
 "confidence": 0.98,
 "line": 1
 }
 ],
 "lines": [
 {
 "text": "Hello World",
 "bbox": [10, 20, 100, 40],
 "confidence": 0.95,
 "words": [0, 1]
 }
 ],
 "blocks": [
 {
 "text": "Hello World\nThis is a test",
 "bbox": [10, 20, 200, 100],
 "type": "paragraph"
 }
 ]
}
```

## 4. STT Engine

### 4.1 Multi-Engine Architecture

```python
class STTEngine:
 def __init__(self):
 self.engines = {
 'whisper': WhisperEngine(model='large-v3'),
 'deepgram': DeepgramEngine(api_key=DEEPGRAM_KEY)
 }

 async def transcribe(self, audio: Audio, config: STTConfig) -> STTResult:
 # Preprocess audio
 processed = self.preprocess(audio, config.preprocessing)

 # Select engine based on requirements
 if config.speaker_diarization:
 engine = self.engines['deepgram']
 elif config.word_timestamps:
 engine = self.engines['whisper']
 else:
 engine = self.engines['whisper'] # default

 result = await engine.transcribe(processed, config)

 # Post-process
 result = self.postprocess(result, config)

 return result
```

### 4.2 Preprocessing Pipeline

```python
class AudioPreprocessor:
 def process(self, audio: Audio, config: PreprocessConfig) -> Audio:
 # Load audio
 waveform, sr = librosa.load(audio.path, sr=16000)

 if config.noise_reduction:
 waveform = self.spectral_gate(waveform)

 if config.normalization:
 waveform = librosa.util.normalize(waveform)

 if config.vad_trim:
 waveform = self.trim_silence(waveform)

 return Audio(waveform, sr)
```

### 4.3 Engine Specifications

| Engine | Best For | Languages | Features | Speed |
|--------|----------|-----------|----------|-------|
| Whisper | General purpose, accuracy | 99 | Timestamps, translation | Medium |
| Deepgram | Real-time, enterprise | 30+ | Diarization, keywords | Fast |

### 4.4 Output Format

```json
{
 "transcript": "Full transcript text",
 "confidence": 0.92,
 "language": "en",
 "duration": 45.2,
 "words": [
 {
 "word": "Hello",
 "start": 0.5,
 "end": 0.8,
 "confidence": 0.95,
 "speaker": "A"
 }
 ],
 "segments": [
 {
 "text": "Hello world",
 "start": 0.5,
 "end": 1.5,
 "speaker": "A"
 }
 ]
}
```

## 5. Model Router Algorithm

### 5.1 Routing Decision Matrix

```python
class ModelRouter:
 def __init__(self):
 self.models = self.load_model_configs()
 self.performance_history = self.load_history()

 def route(self, analysis: AnalysisResult, preferences: UserPreferences) -> RoutingDecision:
 # Filter available models
 candidates = self.filter_models(analysis, self.models)

 # Score each candidate
 scores = {}
 for model in candidates:
 scores[model.id] = self.score_model(model, analysis, preferences)

 # Select best model
 best_model = max(scores, key=scores.get)

 # Build fallback chain
 fallback_chain = self.build_fallback_chain(candidates, best_model)

 return RoutingDecision(
 selected_model=best_model,
 confidence=scores[best_model],
 estimated_cost=self.estimate_cost(best_model, analysis),
 estimated_latency=self.estimate_latency(best_model, analysis),
 fallback_chain=fallback_chain,
 reasoning=self.explain_decision(best_model, analysis, scores)
 )

 def score_model(self, model, analysis, preferences) -> float:
 scores = {
 'capability': self.score_capability(model, analysis),
 'cost': self.score_cost(model, preferences.budget),
 'latency': self.score_latency(model, preferences.max_latency),
 'quality': self.score_quality(model, analysis),
 'availability': self.score_availability(model)
 }

 weights = self.get_weights(preferences.priority)
 return sum(scores[k] * weights[k] for k in scores)
```

### 5.2 Capability Scoring

```python
def score_capability(model, analysis):
 score = 0.0

 # Vision capability (for image modalities)
 if analysis.modality in ['image_text', 'image_voice', 'image_only']:
 if 'vision' in model.capabilities:
 score += 0.3
 else:
 score -= 0.5 # Heavy penalty for non-vision models

 # Reasoning capability
 if analysis.reasoning.type == 'multi_step':
 if 'reasoning' in model.capabilities:
 score += 0.2

 # Code capability
 if analysis.subject.primary == 'computer_science':
 if 'code' in model.capabilities:
 score += 0.15

 # Context window adequacy
 required_ctx = analysis.estimated_tokens * 2
 if model.context_window >= required_ctx:
 score += 0.15
 else:
 score -= 0.3

 return min(1.0, max(0.0, score))
```

### 5.3 Model Selection Rules

| Complexity | Subject | Recommended Models | Fallback |
|------------|---------|-------------------|----------|
| LOW | General | gemini-flash, llama-3.1-8b | gpt-3.5-turbo |
| LOW | Code | gemini-flash, codellama | gpt-3.5-turbo |
| MEDIUM | General | claude-3.5-sonnet, gpt-4o-mini | gemini-pro |
| MEDIUM | Code | claude-3.5-sonnet, gpt-4o | gpt-4o-mini |
| HIGH | Math/Science | claude-3.5-sonnet, gpt-4o, o1-mini | gpt-4o |
| HIGH | Code | claude-3.5-sonnet, gpt-4o, o1-mini | gpt-4o |
| CRITICAL | Any | o1, claude-3.5-sonnet, gpt-4o | gpt-4o |
| Vision | Any | gpt-4o, claude-3.5-sonnet, gemini-pro | gemini-flash |

## 6. System Instruction Engine

### 6.1 Profile Selection Logic

```python
class InstructionProfileSelector:
 def select(self, analysis: AnalysisResult) -> SystemInstructionProfile:
 # Step 1: Filter by modality
 candidates = self.filter_by_modality(analysis.modality)

 # Step 2: Filter by subject
 candidates = self.filter_by_subject(candidates, analysis.subject.primary)

 # Step 3: Filter by complexity
 candidates = self.filter_by_complexity(candidates, analysis.complexity.level)

 # Step 4: Score by matching specificity
 scored = [(c, self.score_match(c, analysis)) for c in candidates]
 scored.sort(key=lambda x: x[1], reverse=True)

 # Step 5: Return best match or default
 if scored and scored[0][1] > 0.5:
 return scored[0][0]
 return self.get_default_profile()
```

### 6.2 Dynamic Configuration

Based on the Google AI Studio system instructions (from reference images):

```python
class SystemInstructionConfig:
 temperature: float = 0.7 # 0.0 - 2.0
 thinking_mode: bool = False # Enable reasoning mode
 thinking_budget: int = 0 # Max thinking tokens
 structured_outputs: bool = False # JSON mode
 code_execution: bool = False # Sandbox code execution
 function_calling: bool = False # Tool use
 grounding_google_search: bool = False
 grounding_google_maps: bool = False
 url_context: bool = False # URL content fetching
```

---
*Version: 1.0 | Date: 2026-07-12*
