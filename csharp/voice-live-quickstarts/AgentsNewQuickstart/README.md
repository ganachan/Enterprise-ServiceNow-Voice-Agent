# C# – Agents New Quickstart

This sample demonstrates the **Voice Live + Foundry Agent v2** flow using the Azure AI Voice Live SDK for .NET. It contains two programs:

- **`CreateAgentWithVoiceLive.cs`** – Creates (or updates) a Foundry agent and stores the Voice Live session configuration in the agent's metadata.
- **`VoiceLiveWithAgentV2.cs`** – Connects to Voice Live using `AgentSessionConfig`, captures microphone audio, and plays back the agent's responses in real-time.

## Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download) or later
- A working microphone and speakers
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) installed and logged in (`az login`)
- An [Azure AI Foundry project](https://learn.microsoft.com/azure/ai-studio/how-to/create-projects) with:
  - A model deployment (e.g., `gpt-4o-mini`)
  - A Voice Live endpoint

## Setup

Set the required environment variables before running either program. You can export them in your shell, add them to a `.env` file, or configure them in your IDE's launch settings:

```bash
# Required for CreateAgentWithVoiceLive.cs
export PROJECT_ENDPOINT="<your-project-endpoint>"
export AGENT_NAME=my-voice-agent
export MODEL_DEPLOYMENT_NAME=gpt-4o-mini

# Required for VoiceLiveWithAgentV2.cs
export VOICELIVE_ENDPOINT=https://<your-voicelive-endpoint>.services.ai.azure.com/
export PROJECT_NAME=<your-project-name>
# AGENT_NAME is shared between both programs
```

On Windows (PowerShell):
```powershell
$env:PROJECT_ENDPOINT = "<your-project-endpoint>"
$env:AGENT_NAME = "my-voice-agent"
$env:MODEL_DEPLOYMENT_NAME = "gpt-4o-mini"
$env:VOICELIVE_ENDPOINT = "https://<your-voicelive-endpoint>.services.ai.azure.com/"
$env:PROJECT_NAME = "<your-project-name>"
```

## Step 1 – Create an agent

`CreateAgentWithVoiceLive.cs` is excluded from the default project build and must be compiled separately. Run it with the `dotnet run` command using a script file argument:

```bash
dotnet run --project VoiceLiveWithAgent.csproj CreateAgentWithVoiceLive.cs
```

Expected output:
```
Agent created: my-voice-agent (id: asst_...)

Voice Live configuration:
{
  "session": {
    "voice": { "name": "en-US-Ava:DragonHDLatestNeural", ... },
    ...
  }
}
```

The program stores the Voice Live session settings (voice, VAD, noise reduction, etc.) as chunked metadata entries on the agent so the service can apply them automatically at connection time.

## Step 2 – Run the voice assistant

Build and run the voice assistant:

```bash
dotnet run --project VoiceLiveWithAgent.csproj
```

Expected output:
```
Environment variables:
VOICELIVE_ENDPOINT: https://...
...
🎙️ Basic Foundry Voice Agent with Azure VoiceLive SDK (Agent Mode)
=================================================================
Connecting to VoiceLive API with agent config...

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

Conversation transcripts and session details are written to a timestamped file in the `logs/` subfolder of the working directory.

Press **Ctrl+C** to exit gracefully.

## Environment Variables Reference

### `CreateAgentWithVoiceLive.cs`

| Variable | Required | Description |
|---|---|---|
| `PROJECT_ENDPOINT` | ✅ | Azure AI Foundry project connection string |
| `AGENT_NAME` | ✅ | Name of the agent to create |
| `MODEL_DEPLOYMENT_NAME` | ✅ | Model deployment name (e.g., `gpt-4o-mini`) |

### `VoiceLiveWithAgentV2.cs`

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
| `Set PROJECT_ENDPOINT, AGENT_NAME, and MODEL_DEPLOYMENT_NAME` | Ensure all required environment variables are set. |
| `Set VOICELIVE_ENDPOINT, AGENT_NAME, and PROJECT_NAME` | Ensure all required environment variables are set. |
| `❌ No audio input devices found` | Connect a microphone and restart. |
| `❌ No audio output devices found` | Connect speakers or headphones and restart. |
| Authentication errors | Run `az login` and ensure your account has access to the Foundry project. |
| Agent not found | Run `CreateAgentWithVoiceLive.cs` first to create the agent, or verify `AGENT_NAME` matches an existing agent. |

## Additional Resources

- [Voice Live Documentation](https://learn.microsoft.com/azure/ai-services/speech-service/voice-live)
- [Azure AI Foundry Documentation](https://learn.microsoft.com/azure/ai-studio/)
- [.NET SDK Documentation](https://learn.microsoft.com/dotnet/api/overview/azure/ai-voicelive-readme)
- [Support Guide](../../../SUPPORT.md)
