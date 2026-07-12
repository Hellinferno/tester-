FROM python:3.11-slim

WORKDIR /app

# libgl1 replaces libgl1-mesa-glx (removed in newer Debian). Needed only if
# OpenCV-based OCR engines are added; harmless otherwise.
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/

ENV PYTHONPATH=/app/src
EXPOSE 8002

# Bind Render's injected $PORT (falls back to 8002 for local docker runs).
CMD ["sh", "-c", "uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8002}"]
