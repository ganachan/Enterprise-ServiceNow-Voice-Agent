# Known Issues — Java Backend (azure-ai-voicelive 1.0.0-beta.4)

This document tracks known gaps between the Java SDK (`azure-ai-voicelive` 1.0.0-beta.4) and the Python SDK, along with workarounds applied in this implementation.

## 1. No Interim Response Support

**Issue:** The Java SDK beta.4 does not have `LlmInterimResponseConfig`, `StaticInterimResponseConfig`, or `InterimResponseTrigger` classes.

**Impact:** Interim response configuration from the frontend (`interim_response`, `interim_response_type`, `interim_trigger_tool`, etc.) is accepted but silently ignored.

**Workaround:** The `SessionConfig` stores all interim response fields for forward compatibility, but `VoiceLiveHandler.configureSession()` does not set them on the session options.

**Expected Fix:** Future SDK release will add interim response support.

## 2. No Strongly-Typed Agent Configuration

**Issue:** The Java SDK beta.4 does not have a strongly-typed `AgentSessionConfig` or equivalent for agent mode connections. The Python SDK uses `connect(agent_config=...)` to pass agent name, project, and version.

**Impact:** Agent mode connections use the same `client.startSession(model)` pattern as model mode. Agent-specific fields (agent name, project, version, conversation ID, foundry resource override) are not sent to the service.

**Workaround:** The backend accepts all agent configuration fields from the frontend and stores them in `SessionConfig` for forward compatibility. When the SDK adds agent mode support, the `VoiceLiveHandler.start()` method can be updated to use the appropriate API.

**Expected Fix:** Future SDK release will add agent mode connection support.

## 3. Pre-generated Greeting via Raw JSON

**Issue:** The typed `startResponse()` methods on `VoiceLiveSessionAsyncClient` do not accept `ResponseCreateParams` directly.

**Impact:** Pre-generated greetings (with `pre_generated_assistant_message`) are sent as raw JSON via `session.send(BinaryData)`.

**Workaround:** LLM-generated greetings use the typed `session.addItem()` + `session.startResponse()` API. Only pre-generated greetings require raw JSON.

## 4. .env File Loading

**Issue:** Java doesn't have a built-in `dotenv` equivalent. The Python backend uses `python-dotenv`.

**Impact:** The `Application.loadDotEnv()` method provides a simple `.env` file parser that sets values as system properties (not environment variables).

**Workaround:** Environment variable lookups check `System.getenv()` first, then fall back to `System.getProperty()` (set by the `.env` loader). For production, set environment variables directly.
