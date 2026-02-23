# Voice Live Web Samples

Web-based code samples for the [Azure Speech Voice Live API](https://learn.microsoft.com/azure/ai-services/speech-service/voice-live-overview) featuring a shared React frontend and language-specific backends.

## Architecture

```
┌─────────────────────┐   WebSocket    ┌──────────────────┐   Voice Live SDK   ┌──────────────┐
│  React + Vite       │◄──────────────►│  Backend Server  │◄─────────────────►│  Azure Voice  │
│  (shared frontend)  │  JSON + PCM16  │  (Python/JS/…)   │   PCM16 + events  │  Live Service │
└─────────────────────┘                └──────────────────┘                    └──────────────┘
```

The frontend builds to static files served by the backend — no separate frontend server needed in production.

## Prerequisites

- **Node.js** 18+ and npm (for building the frontend)
- **Python** 3.9+ (for the Python backend)
- **Java** 17+ and Maven 3.8+ (for the Java backend)
- An **Azure AI Services** resource with Voice Live API access

## Authentication

**Recommended (RBAC):** Use `DefaultAzureCredential` — no API keys required.

```bash
az login   # Local development — authenticates via Azure CLI
```

For deployed environments, the `azd` infrastructure provisions a **system-assigned managed identity** with the **Cognitive Services User** role, enabling token-based auth without any keys.

**Fallback (API key):** Set `AZURE_VOICELIVE_API_KEY` in `.env` only if token-based auth is unavailable for your resource.

## Quick Start (Python)

### 1. Build the frontend

```bash
cd frontend
npm install
npm run build
```

This creates `frontend/dist/` with the static files that the backend will serve.

### 2. Set up the Python backend

```bash
cd python

# Create and activate a virtual environment
python -m venv .venv

# Activate the venv
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Windows (cmd):
.venv\Scripts\activate.bat
# macOS / Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure environment variables

```bash
cp .env.sample .env
```

Edit `.env` with your credentials:

```env
# Required
AZURE_VOICELIVE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/

# Authentication: DefaultAzureCredential is used by default (az login).
# Set API key below only as a fallback if token auth is unavailable.
AZURE_VOICELIVE_API_KEY=

# Connection mode: "model" (default) or "agent" (Foundry Agent Service)
VOICELIVE_MODE=model

# Model mode settings (default — works with just a Foundry resource)
VOICELIVE_MODEL=gpt-realtime
VOICELIVE_VOICE=en-US-Ava:DragonHDLatestNeural
VOICELIVE_TRANSCRIBE_MODEL=gpt-4o-transcribe

# Agent mode settings (when VOICELIVE_MODE=agent)
AZURE_VOICELIVE_AGENT_NAME=your-agent-name
AZURE_VOICELIVE_PROJECT=your-project-name
```

### 4. Run the server

```bash
python app.py
```

Open **http://localhost:8000** in your browser. Click **Start session** and allow microphone access when prompted.

## Quick Start (Java)

### 1. Build the frontend

```bash
cd frontend
npm install
npm run build
```

### 2. Set up the Java backend

```bash
cd java
cp .env.sample .env
# Edit .env with your Azure Voice Live endpoint
```

### 3. Build and run

```bash
mvn clean package -DskipTests
java -jar target/voice-live-universal-assistant-1.0.0.jar
```

Or with Maven directly:

```bash
mvn spring-boot:run
```

Open **http://localhost:8000** in your browser.

> **Note:** See [java/KNOWN_ISSUES.md](java/KNOWN_ISSUES.md) for SDK feature gaps in the current beta release.

## Connection Modes

| Mode    | Use case | How it works |
|---------|----------|-------------|
| `model` | Direct model access / BYOM (default) | Caller configures model, voice, system prompt. Works with just an endpoint — no agent setup required. Set `VOICELIVE_MODEL` and `VOICELIVE_VOICE`. |
| `agent` | Foundry Agent Service integration | Agent defines instructions, tools, and voice. Set `AZURE_VOICELIVE_AGENT_NAME` and `AZURE_VOICELIVE_PROJECT`. Auto-set when deploying with `CREATE_AGENT=true`. |

Switch modes by setting `VOICELIVE_MODE` in `.env` or via the Settings panel in the UI.

## Project Structure

```
voice-live-universal-assistant/
├── frontend/                  # Shared React + Vite + TypeScript frontend
│   ├── public/
│   │   ├── audio-capture-worklet.js    # Mic capture AudioWorklet (24kHz PCM16)
│   │   └── audio-playback-worklet.js   # Audio playback AudioWorklet
│   └── src/
│       ├── components/        # UI components (VoiceOrb, StartScreen, etc.)
│       ├── hooks/             # React hooks (useAudioCapture, useAudioPlayback, useVoiceSession)
│       ├── types.ts           # Shared TypeScript types
│       ├── App.tsx            # Root component
│       └── main.tsx           # Entry point
├── python/                    # Python backend (FastAPI + Voice Live SDK)
│   ├── app.py                 # FastAPI server with WebSocket endpoint
│   ├── voice_handler.py       # VoiceLiveHandler — SDK bridge
│   ├── tests/                 # 91 automated tests (settings + agent mode)
│   ├── requirements.txt       # Python dependencies
│   ├── .env.sample            # Environment variable template
│   └── README.md              # Python-specific docs
├── java/                      # Java backend (Spring Boot + Voice Live SDK)
│   ├── src/                   # Spring Boot application source
│   ├── pom.xml                # Maven config (azure-ai-voicelive 1.0.0-beta.4)
│   ├── KNOWN_ISSUES.md        # SDK feature gaps and workarounds
│   ├── .env.sample            # Environment variable template
│   └── README.md              # Java-specific docs
├── javascript/                # JavaScript/Node.js backend (🚧 Coming soon)
├── csharp/                    # C# ASP.NET Core backend (🚧 Coming soon)
├── infra/                     # Azure Bicep IaC
│   ├── main.bicep             # Entry point (Container Apps + optional Foundry + Agent)
│   ├── main-app.bicep         # Container App with Voice Live env vars
│   ├── main-infrastructure.bicep  # Log Analytics, ACR, Container Apps Env
│   ├── modules/
│   │   ├── foundry.bicep      # AI Foundry account + project (optional)
│   │   └── foundry-rbac.bicep # Azure AI User role for tracing
│   └── core/host/             # Reusable modules (container-app, container-registry)
├── deployment/
│   ├── hooks/
│   │   ├── postprovision.ps1  # RBAC assignment (+ Foundry RBAC when enabled)
│   │   ├── predeploy.ps1      # ACR cloud build + Container App update
│   │   └── postdeploy.ps1     # Foundry Agent creation (when createAgent=true)
│   └── scripts/
│       └── create_agent.py    # Agent creation with Voice Live metadata
├── img/                       # UX mockup reference images
└── README.md                  # This file
```

## Deployment (Azure Developer CLI)

### Option 1: Basic — Container App only (default)

Deploys the web app connecting to your **existing** Azure AI Services resource in **model mode** (no agent required):

```bash
azd auth login
azd init

# Required: set your Voice Live endpoint
azd env set AZURE_VOICELIVE_ENDPOINT "https://your-resource.cognitiveservices.azure.com/"

# Optional: choose backend language (default: python)
azd env set BACKEND_LANGUAGE java   # python | java | javascript | csharp

# Default mode is "model" — works out of the box with just an endpoint.
# To use agent mode instead:
azd env set VOICELIVE_MODE agent
azd env set AZURE_VOICELIVE_AGENT_NAME "your-agent-name"
azd env set AZURE_VOICELIVE_PROJECT "your-project-name"

# Optional: API key (only if token auth is unavailable for your resource)
azd env set AZURE_VOICELIVE_API_KEY "your-api-key"

azd up
```

This provisions:
- **Container Apps Environment** with Log Analytics
- **Container Registry** (ACR cloud build — no local Docker required)
- **Container App** with system-assigned managed identity
- **RBAC** — Cognitive Services User for token-based auth

### Option 2: With Foundry — Create AI Foundry + model mode

Provisions a new AI Foundry resource with `gpt-realtime` model deployment and configures the app for **model mode** — no additional configuration required:

```bash
azd auth login
azd init
azd env set CREATE_FOUNDRY true
# Optional: choose backend language (default: python)
azd env set BACKEND_LANGUAGE java
azd up
```

This adds (fully automatic — no manual endpoint/model config needed):
- **AI Services Account** (kind: AIServices) with system-assigned identity
- **AI Foundry Project** under the account
- **gpt-4o-realtime-preview** model deployment (as `gpt-realtime`)
- **Azure AI User** + **Azure AI Developer** roles
- Container App configured with provisioned endpoint + model mode

### Option 3: With Agent — Foundry + GPT-4.1-mini + Foundry Agent

Full end-to-end: provisions Foundry, deploys GPT-4.1-mini, and creates an agent with Voice Live configuration — no additional configuration required:

```bash
azd auth login
azd init
azd env set CREATE_AGENT true
# Optional: customize agent name (default: voicelive-assistant)
azd env set AGENT_NAME "my-voice-assistant"
azd up
```

> **Note:** `CREATE_AGENT` automatically enables `CREATE_FOUNDRY` — you don't need to set both.

This adds (fully automatic):
- Everything from Option 2
- **GPT-4.1-mini** model deployment (for the agent)
- **Foundry Agent** created via Python SDK with Voice Live session config (Azure voice, semantic VAD, noise suppression, echo cancellation)
- Container App configured with agent name, project, and **agent mode**

### Deployment parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `BACKEND_LANGUAGE` | `python` | Backend language: `python`, `java`, `javascript`, `csharp` |
| `AZURE_VOICELIVE_ENDPOINT` | — | Voice Live endpoint (required for basic, auto-set with Foundry) |
| `VOICELIVE_MODE` | `model` | Connection mode (`model` by default; auto-set to `agent` when `CREATE_AGENT=true`) |
| `AZURE_VOICELIVE_AGENT_NAME` | — | Agent name (auto-set when `CREATE_AGENT=true`) |
| `AZURE_VOICELIVE_PROJECT` | — | Foundry project (auto-set when Foundry provisioned) |
| `CREATE_FOUNDRY` | `false` | Create AI Foundry account + project + model |
| `CREATE_AGENT` | `false` | Create Foundry Agent (implies `CREATE_FOUNDRY`; sets mode to `agent`) |
| `FOUNDRY_ACCOUNT_NAME` | auto-generated | Custom name for the AI Services account |
| `FOUNDRY_PROJECT_NAME` | `voicelive-project` | Name for the Foundry project |
| `AGENT_MODEL_DEPLOYMENT_NAME` | `gpt-4.1-mini` | Model deployment name for agent |
| `AGENT_NAME` | `voicelive-assistant` | Name for the created agent |

## Development

For local development with hot-reload on both frontend and backend:

**Terminal 1 — Frontend dev server** (with proxy to backend):
```bash
cd frontend
npm run dev
```

**Terminal 2 — Python backend**:
```bash
cd python
.venv\Scripts\Activate.ps1   # or source .venv/bin/activate
python app.py
```

The Vite dev server at `http://localhost:5173` proxies WebSocket and API calls to `http://localhost:8000`.

## WebSocket Protocol

The frontend and backend communicate over WebSocket at `/ws/{clientId}`.

| Direction | Message | Description |
|-----------|---------|-------------|
| Client → Server | `start_session` | Begin voice session with config |
| Client → Server | `audio_chunk` | Base64 PCM16 mic audio (24kHz, mono) |
| Client → Server | `interrupt` | Cancel current agent response |
| Client → Server | `stop_session` | End the session |
| Server → Client | `session_started` | Session ready, includes config |
| Server → Client | `audio_data` | Base64 PCM16 agent audio response |
| Server → Client | `transcript` | User or assistant transcript text |
| Server → Client | `status` | State change (listening/thinking/speaking) |
| Server → Client | `stop_playback` | Stop audio playback (barge-in) |
| Server → Client | `session_stopped` | Session ended |
| Server → Client | `error` | Error message |

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

Copyright (c) Microsoft Corporation. All rights reserved.
