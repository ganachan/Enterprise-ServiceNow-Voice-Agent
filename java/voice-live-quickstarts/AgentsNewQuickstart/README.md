# Java – Agents New Quickstart

This sample demonstrates the **Voice Live + Foundry Agent v2** flow using the Azure AI Voice Live SDK for Java. It contains two classes:

- **`CreateAgentWithVoiceLive.java`** – Creates (or updates) a Foundry agent and stores the Voice Live session configuration in the agent's metadata.
- **`VoiceLiveWithAgentV2.java`** – Connects to Voice Live using `AgentSessionConfig`, captures microphone audio, and plays back the agent's responses in real-time.

## Prerequisites

- Java 11 or later
- [Apache Maven](https://maven.apache.org/) 3.6 or later
- A working microphone and speakers
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) installed and logged in (`az login`)
- An [Azure AI Foundry project](https://learn.microsoft.com/azure/ai-studio/how-to/create-projects) with:
  - A model deployment (e.g., `gpt-4o-mini`)
  - A Voice Live endpoint

## Setup

Set the required environment variables before running either script. You can export them in your shell or add them to your IDE's run configuration:

```bash
# Required for CreateAgentWithVoiceLive
export PROJECT_ENDPOINT=https://<your-project>.services.ai.azure.com/
export AGENT_NAME=my-voice-agent
export MODEL_DEPLOYMENT_NAME=gpt-4o-mini

# Required for VoiceLiveWithAgentV2
export VOICELIVE_ENDPOINT=https://<your-voicelive-endpoint>.services.ai.azure.com/
export PROJECT_NAME=<your-project-name>
# AGENT_NAME is shared between both programs
```

## Step 1 – Create an agent

Compile and run the agent-creation class to register your agent and embed the Voice Live configuration in its metadata:

```bash
mvn compile -f pom-agent.xml
mvn exec:java -f pom-agent.xml -Dexec.mainClass="CreateAgentWithVoiceLive"
```

Expected output:
```
Agent created: my-voice-agent (version 1)

Voice Live configuration:
{"session":{"voice":{"name":"en-US-Ava:DragonHDLatestNeural",...},...}}
```

The class stores the Voice Live session settings (voice, VAD, noise reduction, etc.) as chunked metadata entries on the agent so the service can apply them automatically at connection time.

## Step 2 – Run the voice assistant

Compile and run the voice assistant:

```bash
mvn compile -f pom-agent.xml
mvn exec:java -f pom-agent.xml -Dexec.mainClass="VoiceLiveWithAgentV2"
```

Expected output:
```
Environment variables:
VOICELIVE_ENDPOINT: https://...
...
🎙️ Basic Foundry Voice Agent with Azure VoiceLive SDK (Agent Mode)
=================================================================

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

### `CreateAgentWithVoiceLive`

| Variable | Required | Description |
|---|---|---|
| `PROJECT_ENDPOINT` | ✅ | Azure AI Foundry project endpoint URL |
| `AGENT_NAME` | ✅ | Name of the agent to create |
| `MODEL_DEPLOYMENT_NAME` | ✅ | Model deployment name (e.g., `gpt-4o-mini`) |

### `VoiceLiveWithAgentV2`

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
| `Microphone not available` | Connect a microphone; ensure the Java Sound API can access it. |
| `Speakers not available` | Connect speakers or headphones. |
| Authentication errors | Run `az login` and ensure your account has access to the Foundry project. |
| Agent not found | Run `CreateAgentWithVoiceLive` first to create the agent, or verify `AGENT_NAME` matches an existing agent. |

## Additional Resources

- [Voice Live Documentation](https://learn.microsoft.com/azure/ai-services/speech-service/voice-live)
- [Azure AI Foundry Documentation](https://learn.microsoft.com/azure/ai-studio/)
- [Java SDK Documentation](https://learn.microsoft.com/java/api/overview/azure/ai-voicelive-readme)
- [Support Guide](../../../SUPPORT.md)
