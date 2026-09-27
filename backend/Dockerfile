# Render (or any Docker host) image for the SECURIX backend.
# Python 3.12 because mediapipe doesn't support 3.13+.
FROM python:3.12-slim

# tesseract-ocr: needed by pytesseract (OCR)
# libzbar0:      needed by pyzbar (Aadhaar QR decoding)
# libgl1, libglib2.0-0: needed by the OpenCV build that mediapipe pulls in
RUN apt-get update && apt-get install -y --no-install-recommends \
        tesseract-ocr \
        libzbar0 \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN mkdir -p uploads

# Render sets $PORT; default to 8000 for local `docker run`.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
