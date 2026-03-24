FROM python:3.12-slim

WORKDIR /app

# Install dependencies first (layer-cache friendly)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all application source files
COPY app.py voice_handler.py voice_handler_single_agent.py cosmos_store.py ./
COPY static/ static/

EXPOSE 3000

# Use 2 workers; adjust via WORKERS env var if needed
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port 3000 --workers ${WORKERS:-2}"]
