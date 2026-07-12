# Integration Guide

## 1. OpenRouter Integration

### 1.1 Setup

1. **Create Account**: Sign up at [openrouter.ai](https://openrouter.ai)
2. **Generate API Key**: Go to Settings → API Keys → Create Key
3. **Add Credits**: Add payment method for API usage
4. **Configure Keys**: Add to environment variables

```bash
# .env
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_TIMEOUT=30
```

### 1.2 API Client Implementation

```python
# services/router_service/src/providers/openrouter_client.py
import httpx
from typing import AsyncGenerator, Dict, Any
from tenacity import retry, stop_after_attempt, wait_exponential

class OpenRouterClient:
 def __init__(self, api_key: str, base_url: str = "https://openrouter.ai/api/v1"):
 self.api_key = api_key
 self.base_url = base_url
 self.client = httpx.AsyncClient(
 base_url=base_url,
 headers={
 "Authorization": f"Bearer {api_key}",
 "HTTP-Referer": "https://slm-router.io",
 "X-Title": "SLM Router"
 },
 timeout=30.0
 )

 @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
 async def chat_completion(
 self,
 model: str,
 messages: list,
 temperature: float = 0.7,
 max_tokens: int = 4096,
 stream: bool = False,
 **kwargs
 ) -> Dict[str, Any]:
 payload = {
 "model": model,
 "messages": messages,
 "temperature": temperature,
 "max_tokens": max_tokens,
 "stream": stream,
 **kwargs
 }

 if stream:
 return await self._stream_completion(payload)

 response = await self.client.post("/chat/completions", json=payload)
 response.raise_for_status()
 return response.json()

 async def _stream_completion(self, payload: dict) -> AsyncGenerator[str, None]:
 async with self.client.stream("POST", "/chat/completions", json=payload) as response:
 async for line in response.aiter_lines():
 if line.startswith("data: "):
 data = line[6:]
 if data != "[DONE]":
 yield data

 async def get_available_models(self) -> list:
 response = await self.client.get("/models")
 response.raise_for_status()
 return response.json().get("data", [])

 async def get_credits(self) -> dict:
 response = await self.client.get("/credits")
 response.raise_for_status()
 return response.json()
```

### 1.3 Supported Models

| Model ID | Provider | Capabilities | Context | Cost/1K In | Cost/1K Out |
|----------|----------|-------------|---------|------------|-------------|
| anthropic/claude-3.5-sonnet | Anthropic | vision, code, reasoning | 200K | $3.00 | $15.00 |
| openai/gpt-4o | OpenAI | vision, code, reasoning | 128K | $5.00 | $15.00 |
| openai/gpt-4o-mini | OpenAI | vision, code | 128K | $0.15 | $0.60 |
| google/gemini-flash-1.5 | Google | vision, code, multilingual | 1M | $0.075 | $0.30 |
| google/gemini-pro-1.5 | Google | vision, code, reasoning | 1M | $3.50 | $10.50 |
| meta-llama/llama-3.1-70b-instruct | Meta | reasoning, multilingual | 128K | $0.88 | $0.88 |
| mistralai/mistral-large | Mistral | reasoning, code | 32K | $3.00 | $9.00 |
| deepseek/deepseek-coder | DeepSeek | code | 64K | $0.14 | $0.28 |
| qwen/qwen-2.5-72b-instruct | Alibaba | multilingual, reasoning | 128K | $0.80 | $0.80 |
| x-ai/grok-2 | xAI | reasoning, vision | 128K | $5.00 | $15.00 |

### 1.4 Error Handling

```python
class OpenRouterError(Exception):
 pass

class OpenRouterRateLimit(OpenRouterError):
 pass

class OpenRouterModelUnavailable(OpenRouterError):
 pass

async def handle_openrouter_error(error: httpx.HTTPStatusError):
 if error.response.status_code == 429:
 retry_after = int(error.response.headers.get("Retry-After", 60))
 raise OpenRouterRateLimit(f"Rate limited. Retry after {retry_after}s")
 elif error.response.status_code == 503:
 raise OpenRouterModelUnavailable("Model temporarily unavailable")
 elif error.response.status_code >= 500:
 raise OpenRouterError(f"Server error: {error.response.text}")
 else:
 raise OpenRouterError(f"Client error: {error.response.text}")
```

### 1.5 Key Rotation

```python
class KeyRotator:
 def __init__(self, keys: list[str]):
 self.keys = keys
 self.current_index = 0
 self.failed_keys = set()

 def get_key(self) -> str:
 available = [k for k in self.keys if k not in self.failed_keys]
 if not available:
 raise Exception("All API keys exhausted")
 return available[self.current_index % len(available)]

 def mark_failed(self, key: str):
 self.failed_keys.add(key)
 if len(self.failed_keys) == len(self.keys):
 self.failed_keys.clear() # Reset after cooldown
```

## 2. OCR Engine Integration

### 2.1 Tesseract Setup

```bash
# Ubuntu/Debian
sudo apt-get install tesseract-ocr tesseract-ocr-eng tesseract-ocr-fra

# macOS
brew install tesseract

# Python
pip install pytesseract Pillow
```

```python
import pytesseract
from PIL import Image

class TesseractEngine:
 def __init__(self, lang='eng'):
 self.lang = lang

 def extract(self, image: Image.Image) -> dict:
 # Get detailed data
 data = pytesseract.image_to_data(
 image, 
 lang=self.lang, 
 output_type=pytesseract.Output.DICT
 )

 text = pytesseract.image_to_string(image, lang=self.lang)

 return {
 'text': text,
 'confidence': self._calculate_confidence(data),
 'words': self._extract_words(data),
 'raw': data
 }
```

### 2.2 EasyOCR Setup

```bash
pip install easyocr
```

```python
import easyocr

class EasyOCREngine:
 def __init__(self, lang_list=['en']):
 self.reader = easyocr.Reader(lang_list, cpu=True)

 def extract(self, image_path: str) -> dict:
 results = self.reader.readtext(image_path, detail=1)

 text = ' '.join([r[1] for r in results])

 return {
 'text': text,
 'confidence': sum([r[2] for r in results]) / len(results),
 'words': [
 {
 'text': r[1],
 'bbox': r[0],
 'confidence': r[2]
 }
 for r in results
 ]
 }
```

### 2.3 PaddleOCR Setup

```bash
pip install paddleocr paddlepaddle-cpu
```

```python
from paddleocr import PaddleOCR

class PaddleOCREngine:
 def __init__(self, lang='en'):
 self.ocr = PaddleOCR(
 use_angle_cls=True,
 lang=lang,
 use_cpu=True
 )

 def extract(self, image_path: str) -> dict:
 result = self.ocr.ocr(image_path, cls=True)

 text = '
'.join([line[1][0] for line in result[0]])

 return {
 'text': text,
 'confidence': sum([line[1][1] for line in result[0]]) / len(result[0]),
 'words': [
 {
 'text': line[1][0],
 'bbox': line[0],
 'confidence': line[1][1]
 }
 for line in result[0]
 ]
 }
```

## 3. STT Engine Integration

### 3.1 Whisper Setup

```bash
pip install openai-whisper torch
```

```python
import whisper

class WhisperEngine:
 def __init__(self, model_size='large-v3'):
 self.model = whisper.load_model(model_size)

 def transcribe(self, audio_path: str, language=None) -> dict:
 result = self.model.transcribe(
 audio_path,
 language=language,
 word_timestamps=True,
 verbose=False
 )

 return {
 'transcript': result['text'],
 'language': result['language'],
 'segments': result['segments'],
 'words': [
 {
 'word': word['word'],
 'start': word['start'],
 'end': word['end'],
 'confidence': word.get('probability', 0.0)
 }
 for segment in result['segments']
 for word in segment.get('words', [])
 ]
 }
```

### 3.2 Deepgram Setup

```bash
pip install deepgram-sdk
```

```python
from deepgram import DeepgramClient, PrerecordedOptions

class DeepgramEngine:
 def __init__(self, api_key: str):
 self.client = DeepgramClient(api_key)

 async def transcribe(self, audio_path: str, options: dict = None) -> dict:
 opts = PrerecordedOptions(
 model="nova-2",
 language="en",
 smart_format=True,
 punctuate=True,
 diarize=True,
 paragraphs=True,
 utterances=True
 )

 with open(audio_path, 'rb') as audio:
 response = self.client.listen.prerecorded.v(
 "1"
 ).transcribe_file(
 audio, opts
 )

 result = response.results.channels[0].alternatives[0]

 return {
 'transcript': result.transcript,
 'confidence': result.confidence,
 'words': [
 {
 'word': w.word,
 'start': w.start,
 'end': w.end,
 'confidence': w.confidence,
 'speaker': w.speaker
 }
 for w in result.words
 ]
 }
```

## 4. Remote SLM via OpenRouter Integration

### 4.1 vLLM Setup

```bash
# Install llama-cpp-python
pip install llama-cpp-python

# Download model
huggingface-cli download meta-llama/Llama-3.1-8B-Instruct

# Start server
python -m llama_cpp.server --model meta-llama/Llama-3.1-8B-Instruct --n_threads 4 --cpu-memory-utilization 0.85 --max-model-len 32768 --port 8000
```

### 4.2 Setup (Development)

```bash
# Install 
curl -fsSL https://.com/install.sh | sh

# Pull model
 pull llama3.1:8b

# Start server
 serve
```

### 4.3 Client Implementation

```python
import httpx

# SLM Analysis via OpenRouter
# Reuses the same OpenRouterClient from router service
# Uses smaller/cheaper models for analysis (e.g., llama-3.1-8b-instruct)
# Analysis model ID configured via OPENROUTER_ANALYSIS_MODEL env var
```

## 5. Google APIs Integration

### 5.1 Google Search Grounding

```python
from googleapiclient.discovery import build

class GoogleSearchGrounding:
 def __init__(self, api_key: str, cx: str):
 self.service = build("customsearch", "v1", developerKey=api_key)
 self.cx = cx

 def search(self, query: str, num_results: int = 5) -> list:
 result = self.service.cse().list(
 q=query,
 cx=self.cx,
 num=num_results
 ).execute()

 return [
 {
 'title': item['title'],
 'link': item['link'],
 'snippet': item['snippet']
 }
 for item in result.get('items', [])
 ]
```

### 5.2 Google Maps Grounding

```python
import googlemaps

class GoogleMapsGrounding:
 def __init__(self, api_key: str):
 self.client = googlemaps.Client(key=api_key)

 def geocode(self, address: str) -> dict:
 result = self.client.geocode(address)
 return result[0] if result else None

 def places(self, query: str, location: tuple = None) -> list:
 results = self.client.places(query, location=location)
 return results.get('results', [])
```

## 6. Database Integration

### 6.1 PostgreSQL (SQLAlchemy)

```python
from sqlalchemy import create_engine, Column, String, Integer, Float, JSON, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

Base = declarative_base()

class Request(Base):
 __tablename__ = 'requests'

 id = Column(String, primary_key=True)
 user_id = Column(String)
 modality = Column(String)
 status = Column(String)
 created_at = Column(DateTime)
 metadata = Column(JSON)

# Connection
engine = create_engine('postgresql://user:pass@localhost/slm_router')
SessionLocal = sessionmaker(bind=engine)
```

### 6.2 Redis

```python
import redis

class RedisCache:
 def __init__(self, host='localhost', port=6379, db=0):
 self.client = redis.Redis(host=host, port=port, db=db, decode_responses=True)

 def get_analysis(self, input_hash: str) -> dict:
 data = self.client.get(f"analysis:{input_hash}")
 return json.loads(data) if data else None

 def set_analysis(self, input_hash: str, result: dict, ttl=3600):
 self.client.setex(f"analysis:{input_hash}", ttl, json.dumps(result))
```

## 7. Object Storage Integration

### 7.1 MinIO

```python
from minio import Minio

class MinIOStorage:
 def __init__(self, endpoint: str, access_key: str, secret_key: str):
 self.client = Minio(
 endpoint,
 access_key=access_key,
 secret_key=secret_key,
 secure=True
 )
 self.bucket = "slm-router-media"

 def upload(self, object_name: str, file_path: str) -> str:
 self.client.fput_object(self.bucket, object_name, file_path)
 return f"{self.bucket}/{object_name}"

 def download(self, object_name: str, file_path: str):
 self.client.fget_object(self.bucket, object_name, file_path)
```

---
*Version: 1.0 | Date: 2026-07-12*
