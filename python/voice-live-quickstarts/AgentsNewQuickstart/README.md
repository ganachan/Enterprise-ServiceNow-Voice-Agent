# Python – Agents New Quickstart

This sample demonstrates the **Voice Live + Foundry Agent v2** flow using the Azure AI Voice Live SDK for Python. It contains two scripts:

- **`create_agent_v2_with_voicelive.py`** – Creates (or updates) a Foundry agent and stores the Voice Live session configuration in the agent's metadata.
- **`voice-live-with-agent-v2.py`** – Connects to Voice Live using `AgentSessionConfig`, captures microphone audio, and plays back the agent's responses in real-time.

## Prerequisites

- Python 3.8 or later
- A working microphone and speakers
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) installed and logged in (`az login`)
- An [Azure AI Foundry project](https://learn.microsoft.com/azure/ai-studio/how-to/create-projects) with:
  - A model deployment (e.g., `gpt-4o-mini`)
  - A Voice Live endpoint

## Setup

1. **Create and activate a virtual environment**:
   ```bash
   python -m venv .venv

   # On Windows
   .venv\Scripts\activate

   # On Linux/macOS
   source .venv/bin/activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Create a `.env` file** in this folder with the following variables:
   ```plaintext
   # Required for create_agent_v2_with_voicelive.py
   PROJECT_ENDPOINT=https://<your-project>.services.ai.azure.com/
   AGENT_NAME=my-voice-agent
   MODEL_DEPLOYMENT_NAME=gpt-4o-mini

   # Required for voice-live-with-agent-v2.py
   VOICELIVE_ENDPOINT=https://<your-voicelive-endpoint>.services.ai.azure.com/
   PROJECT_NAME=<your-project-name>
   # AGENT_NAME is shared between both scripts

   # Optional for voice-live-with-agent-v2.py
   # VOICE_NAME=en-US-Ava:DragonHDLatestNeural
   # AGENT_VERSION=
   # CONVERSATION_ID=
   # FOUNDRY_RESOURCE_OVERRIDE=
   # AGENT_AUTHENTICATION_IDENTITY_CLIENT_ID=
   ```

## Step 1 – Create an agent

Run the agent-creation script to register your agent and embed the Voice Live configuration in its metadata:

```bash
python create_agent_v2_with_voicelive.py
```

Expected output:
```
Agent created: my-voice-agent (version 1)

Voice Live configuration:
{
  "session": {
    "voice": { "name": "en-US-Ava:DragonHDLatestNeural", ... },
    ...
  }
}
```

The script stores the Voice Live session settings (voice, VAD, noise reduction, etc.) as chunked metadata entries on the agent so the service can apply them automatically at connection time.

## Step 2 – Run the voice assistant

Start the interactive voice assistant:

```bash
python voice-live-with-agent-v2.py
```

Expected output:
```
🎙️ Basic Foundry Voice Agent with Azure VoiceLive SDK (Agent Mode)
=================================================================
Environment variables:
VOICELIVE_ENDPOINT: https://...
...

=================================================================
🎤 VOICE ASSISTANT READY
Start speaking to begin conversation
Press Ctrl+C to exit
=================================================================
```

The assistant will:
1. Connect to Voice Live using your agent's configuration.
2. Play a proactive greeting.
3. Capture your microphone input and stream it to the agent.
4. Play back the agent's audio responses in real-time.
5. Support barge-in (interrupting the agent while it is speaking).

Conversation transcripts and session details are written to a timestamped file in the `logs/` subfolder.

Press **Ctrl+C** to exit gracefully.

## Environment Variables Reference

### `create_agent_v2_with_voicelive.py`

| Variable | Required | Description |
|---|---|---|
| `PROJECT_ENDPOINT` | ✅ | Azure AI Foundry project endpoint URL |
| `AGENT_NAME` | ✅ | Name of the agent to create |
| `MODEL_DEPLOYMENT_NAME` | ✅ | Model deployment name (e.g., `gpt-4o-mini`) |

### `voice-live-with-agent-v2.py`

| Variable | Required | Description |
|---|---|---|
| `VOICELIVE_ENDPOINT` | ✅ | Voice Live service endpoint URL |
| `AGENT_NAME` | ✅ | Name of the agent to connect to |
| `PROJECT_NAME` | ✅ | Azure AI Foundry project name |
| `VOICE_NAME` | ☐ | Voice name override (default: `en-US-Ava:DragonHDLatestNeural`) |
| `AGENT_VERSION` | ☐ | Pin to a specific agent version |
| `CONVERSATION_ID` | ☐ | Resume a previous conversation |
| `FOUNDRY_RESOURCE_OVERRIDE` | ☐ | Cross-resource Foundry endpoint |
| `AGENT_AUTHENTICATION_IDENTITY_CLIENT_ID` | ☐ | Managed identity client ID for cross-resource auth |

## Troubleshooting

| Symptom | Resolution |
|---|---|
| `Set VOICELIVE_ENDPOINT, AGENT_NAME, and PROJECT_NAME` | Check your `.env` file contains all required variables. |
| `❌ No audio input devices found` | Connect a microphone and restart. |
| `❌ No audio output devices found` | Connect speakers or headphones and restart. |
| Authentication errors | Run `az login` and ensure your account has access to the Foundry project. |
| Agent not found | Run `create_agent_v2_with_voicelive.py` first to create the agent, or verify `AGENT_NAME` matches an existing agent. |

## Additional Resources

- [Voice Live Documentation](https://learn.microsoft.com/azure/ai-services/speech-service/voice-live)
- [Azure AI Foundry Documentation](https://learn.microsoft.com/azure/ai-studio/)
- [Python SDK Documentation](https://learn.microsoft.com/en-us/python/api/overview/azure/ai-voicelive-readme)
- [Support Guide](../../../SUPPORT.md)
