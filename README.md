# Enterprise ServiceNow Voice Agent

An enterprise-grade, AI-powered voice assistant that integrates **Azure AI Voice Live** with **ServiceNow ITSM** to deliver real-time, avatar-enabled conversational experiences for IT service management.

Agents can create incidents, look up tickets, escalate issues, and guide users through IT workflows — entirely by voice.

---

## Architecture

```
┌─────────────────────────┐         ┌──────────────────────────┐         ┌──────────────────────┐
│    Browser (Frontend)   │◄──WS───►│  Python Server (FastAPI) │◄──SDK──►│  Azure AI Voice Live │
│                         │         │                           │         │  (gpt-4o-realtime)   │
│  • Microphone capture   │         │  • Session management     │         └──────────────────────┘
│  • Audio playback       │         │  • Voice Live SDK bridge  │
│  • Avatar video (WebRTC)│◄─WebRTC──────────────────────────────────── Azure Avatar Service ──►│
│  • Incident dashboard   │         │  • ServiceNow REST calls  │◄──────► ServiceNow Instance
│  • Conversation history │         │  • Cosmos DB persistence  │◄──────► Azure Cosmos DB
└─────────────────────────┘         └──────────────────────────┘
```

**Key components:**
| Layer | Technology |
|---|---|
| Voice AI | Azure AI Voice Live SDK (`gpt-4o-realtime`), Azure AI Foundry |
| Avatar | Azure Avatar Service (WebRTC / fMP4 WebSocket) |
| Backend | Python 3.10+, FastAPI, `azure-ai-voicelive` SDK |
| ITSM | ServiceNow REST API (Table API — incidents, requests) |
| Persistence | Azure Cosmos DB (conversation history per session) |
| Deployment | Docker, Azure Container Apps, Azure Container Registry |

---

## Features

- **Real-time voice conversations** — low-latency bidirectional audio via Azure Voice Live
- **Photorealistic avatar** — video avatar rendered over WebRTC or WebSocket fMP4
- **ServiceNow ITSM integration** — create, query, and update incidents by voice
- **Conversation memory** — full transcript stored per session in Azure Cosmos DB
- **Multi-agent architecture** — pluggable tool definitions (function calling)
- **Docker-first** — fully containerized; single `docker build` + `docker run`
- **One-command Azure deploy** — `deploy.ps1` provisions Container Apps, ACR, and secrets

---

## Getting Started

### Prerequisites

- Python 3.10+
- [Azure subscription](https://azure.microsoft.com/free/) with an [Azure AI Foundry resource](https://learn.microsoft.com/azure/ai-services/speech-service/voice-live) in a supported region
- ServiceNow developer instance ([developer.servicenow.com](https://developer.servicenow.com)) — or a production instance
- (Optional) Azure Cosmos DB account for conversation history

> **Avatar regions:** Southeast Asia, North Europe, West Europe, Sweden Central, South Central US, East US 2, West US 2

### Local setup

1. **Clone and navigate:**
   ```bash
   git clone https://github.com/ganachan/Enterprise-ServiceNow-Voice-Agent.git
   cd Enterprise-ServiceNow-Voice-Agent/python/voice-live-avatar
   ```

2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment — create a `.env` file:**
   ```env
   # Azure AI Voice Live
   AZURE_VOICELIVE_ENDPOINT=https://<your-foundry-resource>.services.ai.azure.com/
   AZURE_VOICELIVE_API_KEY=<your-api-key>          # or use managed identity
   VOICELIVE_MODEL=gpt-4o-realtime
   VOICELIVE_VOICE=en-US-AvaMultilingualNeural

   # ServiceNow
   SNOW_INSTANCE=https://<your-instance>.service-now.com
   SNOW_USER=<username>
   SNOW_PASSWORD=<password>

   # Azure Cosmos DB (optional — for conversation history)
   COSMOS_ENDPOINT=https://<your-account>.documents.azure.com:443/
   COSMOS_KEY=<your-cosmos-key>
   COSMOS_DATABASE=voice-live-avatar
   COSMOS_CONTAINER=conversations
   ```

4. **Run the server:**
   ```bash
   python app.py
   ```
   Or with uvicorn:
   ```bash
   uvicorn app:app --host 0.0.0.0 --port 3000 --reload
   ```

5. **Open the UI:** [http://localhost:3000](http://localhost:3000)

### Docker

```bash
# Build
docker build -t enterprise-snow-voice-agent ./python/voice-live-avatar

# Run (pass your .env file)
docker run -p 3000:3000 --env-file ./python/voice-live-avatar/.env enterprise-snow-voice-agent
```

### Azure Container Apps deployment

Edit the variables at the top of `deploy.ps1` then run:

```powershell
$env:VOICELIVE_API_KEY = "<your-key>"
./python/voice-live-avatar/deploy.ps1
```

The script provisions: Azure Container Registry, builds and pushes the image, creates a Container App with the API key stored as a managed secret, and outputs the public URL.

---

## Project Structure

```
python/voice-live-avatar/
├── app.py                   # FastAPI server — WebSocket, REST endpoints, ServiceNow proxy
├── voice_handler.py         # Azure Voice Live SDK session management & event loop
├── cosmos_store.py          # Cosmos DB conversation persistence
├── static/
│   ├── app.js               # Frontend — audio capture/playback, avatar, incident dashboard
│   └── index.html           # Single-page UI
├── Dockerfile
├── deploy.ps1               # Azure Container Apps deployment script
└── requirements.txt
```

---

## Samples by Language

This repository also contains quickstart samples across multiple languages:

### [C# Samples](./csharp/README.md)
Complete C# samples demonstrating:
- **Agent Quickstart**: Connect to Azure AI Foundry agents with proactive greetings
- **Agents New Quickstart**: Create and run Voice Live-enabled Foundry Agents (new SDK patterns)
- **Model Quickstart**: Direct VoiceLive model integration
- **Bring-Your-Own-Model (BYOM) Quickstart**: Use your own models hosted in Foundry with proactive greetings
- **Customer Service Bot**: Advanced function calling for customer service scenarios and proactive greetings
- Built with .NET 9.0 and self-contained code

### [Python Samples](./python/)
Python samples showcasing:
- **Agent Quickstart**: Azure AI Foundry agent integration with proactive greetings
- **Agents New Quickstart**: Voice Live + Foundry Agent v2 samples and agent-creation utility
- **Model Quickstart**: Direct model access with flexible authentication
- **Bring-Your-Own-Model (BYOM) Quickstart**: Use your own models hosted in Foundry with proactive greetings
- **Function Calling**: Advanced tool integration with custom functions and proactive greetings
- **RAG-enabled Voice Assistant**: Full-stack voice assistant with Azure AI Search integration and `azd` deployment
- **Voice Live Avatar**: Avatar-enabled voice conversations with server-side SDK and Docker deployment
- Built with Python 3.8+ and async/await patterns

### [JavaScript Samples](./javascript/)
JavaScript/TypeScript samples showcasing:
- **Agents New Quickstart**: Node.js Voice Live + Foundry Agent v2 sample and agent-creation utility
- **Model Quickstart**: Direct Voice Live model integration with proactive greetings
- **Basic Web Voice Assistant**: Browser-based voice assistant with real-time streaming and barge-in support
- **Voice Live Avatar**: Avatar-enabled voice conversations with Docker deployment
- **Voice Live Car Demo**: Voice-Enabled Car Assistant powered by multiple architectures
- **Voice Live Interpreter**: Real-time speech translation, speech in and speech out
- **Voice Live Trader**: Real-time trading assistant for stock fund crypto FX trading app
- Built with TypeScript and Web Audio API

### [Java Samples](./java/)
Java samples  showcasing:
- **Agents New Quickstart**: Voice Live + Foundry Agent v2 sample and agent-creation utility
- **Model Quickstart**: Direct model access with flexible authentication
- Built with Java 11+ and Maven

### [Voice Live Universal Assistant](./voice-live-universal-assistant/)
Full-stack web application with a **shared React+Vite+TypeScript frontend** and per-language backend implementations:
- **Shared frontend**: Fluent-aligned design system (light/dark/system themes), voice orb visualization, CC transcript, voice type selection (OpenAI + Azure Standard)
- **Python backend**: FastAPI + WebSocket proxy with Agent and Model mode support
- **Java backend**: Spring Boot + WebSocket proxy with Agent and Model mode support
- **JavaScript, C# backends**: Planned
- **Backend selection**: Set `BACKEND_LANGUAGE` at deploy time (`python`, `java`, `javascript`, `csharp`) — frontend is shared and language-agnostic
- **Connection modes**: Model mode (default — works with just a Foundry endpoint) or Agent mode (auto-set when deploying with `CREATE_AGENT=true`)
- **Azure deployment**: Full `azd up` infrastructure with Bicep IaC — Container Apps, ACR, RBAC, optional AI Foundry provisioning, and optional Foundry Agent creation with GPT-4.1-mini
- 91 unit tests + E2E audio test

Each language folder contains detailed setup instructions, configuration examples, and troubleshooting guides specific to that language and platform.

## Documentation

- [Azure AI Speech Service - Voice Live Documentation](https://learn.microsoft.com/azure/ai-services/speech-service/voice-live)

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](SUPPORT.md#contributing) for details.

Please note that this project follows the [Microsoft Open Source Code of Conduct](CODE_OF_CONDUCT.md).

## Resources

- [Support](SUPPORT.md) - Get help and file issues
- [Security](SECURITY.md) - Security policy and reporting vulnerabilities

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Copyright (c) Microsoft Corporation. All rights reserved.

## Trademarks

This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft trademarks or logos is subject to and must follow [Microsoft's Trademark & Brand Guidelines](https://www.microsoft.com/legal/intellectualproperty/trademarks/usage/general). Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship. Any use of third-party trademarks or logos are subject to those third-party's policies.
