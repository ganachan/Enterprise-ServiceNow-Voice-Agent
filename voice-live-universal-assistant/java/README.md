# Voice Live Universal Assistant — Java Backend

Java (Spring Boot) backend for the Voice Live Universal Assistant, using the `azure-ai-voicelive` Java SDK (1.0.0-beta.4).

## Prerequisites

- Java 17+
- Maven 3.8+
- Azure Voice Live resource with endpoint URL
- Azure CLI logged in (`az login`) or an API key

## Quick Start

1. **Copy and configure environment:**
   ```bash
   cp .env.sample .env
   # Edit .env with your Azure Voice Live endpoint and credentials
   ```

2. **Build and run:**
   ```bash
   mvn clean package -DskipTests
   java -jar target/voice-live-universal-assistant-1.0.0.jar
   ```
   Or with Maven directly:
   ```bash
   mvn spring-boot:run
   ```

3. **Open the frontend** at `http://localhost:8000`

## Architecture

The Java backend replicates the same WebSocket API contract as the [Python backend](../python/):

| File | Purpose |
|------|---------|
| `Application.java` | Spring Boot main, REST endpoints, static serving, CORS |
| `WebSocketConfig.java` | WebSocket registration at `/ws/{clientId}` |
| `VoiceLiveWebSocketHandler.java` | WebSocket message dispatch, session lifecycle |
| `VoiceLiveHandler.java` | SDK bridge — VoiceLive client/session management, event handling |
| `SessionConfig.java` | Typed session configuration with all frontend fields |

## WebSocket Protocol

Identical to the Python backend:

**Client → Server:** `start_session`, `audio_chunk`, `stop_session`, `interrupt`
**Server → Client:** `session_started`, `session_stopped`, `audio_data`, `transcript`, `status`, `stop_playback`, `error`

## REST Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /config` | Server configuration (mode, model, voice, etc.) |
| `GET /languages` | Available STT locales |

## Known Issues

See [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for SDK gaps and workarounds in the beta.4 release.

## Connection Modes

Set `VOICELIVE_MODE` in `.env`:

| Mode    | Description                                      |
|---------|--------------------------------------------------|
| `model` | Connects directly to a model (e.g. gpt-realtime) — default |
| `agent` | Connects via Foundry Agent Service               |

## Settings

All settings are configurable from the frontend UI. Default values can be set via `.env`:

| Setting | Env Variable | Default |
|---------|-------------|---------|
| Mode | `VOICELIVE_MODE` | `model` |
| Model | `VOICELIVE_MODEL` | `gpt-realtime` |
| Voice | `VOICELIVE_VOICE` | `en-US-Ava:DragonHDLatestNeural` |
| Temperature | `VOICELIVE_TEMPERATURE` | `0.7` |
| VAD Type | `VOICELIVE_VAD_TYPE` | `azure_semantic` |
| Instructions | `VOICELIVE_INSTRUCTIONS` | _(empty)_ |
| Agent Name | `AZURE_VOICELIVE_AGENT_NAME` | _(required for agent mode)_ |
| Project | `AZURE_VOICELIVE_PROJECT` | _(required for agent mode)_ |

## Local Development

Build the frontend first, then run the backend:

```bash
# Build frontend (from repo root)
cd frontend && npm install && npm run build && cd ..

# Run Java backend
cd java
cp .env.sample .env
# Edit .env with your endpoint
mvn spring-boot:run
```

The server serves the built frontend from `../frontend/dist/` or `static/`.

