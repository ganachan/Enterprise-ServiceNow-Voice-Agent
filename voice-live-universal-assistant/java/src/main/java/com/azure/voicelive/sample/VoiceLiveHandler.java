package com.azure.voicelive.sample;

import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

import com.azure.ai.voicelive.VoiceLiveAsyncClient;
import com.azure.ai.voicelive.VoiceLiveClientBuilder;
import com.azure.ai.voicelive.VoiceLiveSessionAsyncClient;
import com.azure.ai.voicelive.models.AssistantMessageItem;
import com.azure.ai.voicelive.models.AudioEchoCancellation;
import com.azure.ai.voicelive.models.AudioInputTranscriptionOptions;
import com.azure.ai.voicelive.models.AudioInputTranscriptionOptionsModel;
import com.azure.ai.voicelive.models.AudioNoiseReduction;
import com.azure.ai.voicelive.models.AudioNoiseReductionType;
import com.azure.ai.voicelive.models.AzureSemanticVadTurnDetection;
import com.azure.ai.voicelive.models.AzureSemanticVadTurnDetectionEn;
import com.azure.ai.voicelive.models.AzureSemanticVadTurnDetectionMultilingual;
import com.azure.ai.voicelive.models.AzureStandardVoice;
import com.azure.ai.voicelive.models.InputAudioFormat;
import com.azure.ai.voicelive.models.InputTextContentPart;
import com.azure.ai.voicelive.models.InteractionModality;
import com.azure.ai.voicelive.models.OpenAIVoice;
import com.azure.ai.voicelive.models.OpenAIVoiceName;
import com.azure.ai.voicelive.models.OutputAudioFormat;
import com.azure.ai.voicelive.models.OutputTextContentPart;
import com.azure.ai.voicelive.models.ResponseCreateParams;
import com.azure.ai.voicelive.models.ServerEventType;
import com.azure.ai.voicelive.models.ServerVadTurnDetection;
import com.azure.ai.voicelive.models.SessionUpdate;
import com.azure.ai.voicelive.models.SessionUpdateConversationItemInputAudioTranscriptionCompleted;
import com.azure.ai.voicelive.models.SessionUpdateError;
import com.azure.ai.voicelive.models.SessionUpdateErrorDetails;
import com.azure.ai.voicelive.models.SessionUpdateResponseAudioDelta;
import com.azure.ai.voicelive.models.SessionUpdateResponseAudioTranscriptDelta;
import com.azure.ai.voicelive.models.SystemMessageItem;
import com.azure.ai.voicelive.models.TurnDetection;
import com.azure.ai.voicelive.models.VoiceLiveSessionOptions;
import com.azure.core.util.BinaryData;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import reactor.core.Disposable;

/**
 * Bridges the browser WebSocket to the Azure Voice Live SDK.
 * Manages a single VoiceLive session for one WebSocket client.
 * Equivalent to Python's VoiceLiveHandler class.
 */
public class VoiceLiveHandler {

    private static final Logger logger = LoggerFactory.getLogger(VoiceLiveHandler.class);

    private final String clientId;
    private final String endpoint;
    private final Object credential;
    private final Consumer<Map<String, Object>> sendMessage;
    private final SessionConfig config;

    private VoiceLiveAsyncClient client;
    private VoiceLiveSessionAsyncClient session;
    private Disposable eventSubscription;
    private volatile boolean running = false;
    private boolean greetingSent = false;
    private final StringBuilder assistantTranscript = new StringBuilder();

    public VoiceLiveHandler(String clientId, String endpoint, Object credential,
                            Consumer<Map<String, Object>> sendMessage, SessionConfig config) {
        this.clientId = clientId;
        this.endpoint = endpoint;
        this.credential = credential;
        this.sendMessage = sendMessage;
        this.config = config;
    }

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    /**
     * Open VoiceLive connection, configure session, and begin processing events.
     */
    public void start() {
        running = true;
        try {
            logger.info("[{}] Connecting in {} mode (model={}, voice={})",
                    clientId, config.getMode(), config.getModel(), config.getVoice());

            VoiceLiveClientBuilder builder = new VoiceLiveClientBuilder()
                    .endpoint(endpoint);

            if (credential instanceof com.azure.core.credential.KeyCredential keyCredential) {
                builder.credential(keyCredential);
            } else if (credential instanceof com.azure.core.credential.TokenCredential tokenCredential) {
                builder.credential(tokenCredential);
            }

            client = builder.buildAsyncClient();

            // Start session — agent mode uses model-mode connection (KNOWN ISSUE: no agent config in Java SDK)
            String model = config.getModel();
            session = client.startSession(model).block();

            if (session == null) {
                throw new IllegalStateException("Failed to start VoiceLive session");
            }

            // Configure session
            configureSession();

            // Subscribe to events
            eventSubscription = session.receiveEvents()
                    .doOnNext(this::handleEvent)
                    .doOnError(e -> {
                        logger.error("[{}] Event stream error: {}", clientId, e.getMessage());
                        send("error", "message", e.getMessage());
                    })
                    .doOnComplete(() -> {
                        logger.info("[{}] Event stream completed", clientId);
                        running = false;
                    })
                    .subscribe();

            logger.info("[{}] Session started, event loop active", clientId);

        } catch (Exception e) {
            logger.error("[{}] Failed to start VoiceLive session: {}", clientId, e.getMessage());
            running = false;
            send("error", "message", e.getMessage());
        }
    }

    /**
     * Forward base64-encoded PCM16 audio from the browser to VoiceLive.
     */
    public void sendAudio(String audioBase64) {
        if (session != null && running) {
            try {
                byte[] audioBytes = Base64.getDecoder().decode(audioBase64);
                session.sendInputAudio(audioBytes).block();
            } catch (Exception e) {
                logger.error("[{}] Error forwarding audio: {}", clientId, e.getMessage());
            }
        }
    }

    /**
     * Cancel the current response (user barge-in).
     */
    public void interrupt() {
        if (session != null) {
            try {
                session.cancelResponse().block();
            } catch (Exception e) {
                logger.debug("[{}] No response to cancel: {}", clientId, e.getMessage());
            }
        }
    }

    /**
     * Gracefully shut down the handler.
     */
    public void stop() {
        running = false;
        if (eventSubscription != null && !eventSubscription.isDisposed()) {
            eventSubscription.dispose();
        }
        if (session != null) {
            try {
                session.close();
            } catch (Exception e) {
                logger.debug("[{}] Error closing session: {}", clientId, e.getMessage());
            }
            session = null;
        }
        // VoiceLiveAsyncClient has no close — nullify reference
        client = null;
        logger.info("[{}] Handler stopped", clientId);
    }

    public boolean isRunning() {
        return running;
    }

    // ------------------------------------------------------------------
    // Session configuration
    // ------------------------------------------------------------------

    private void configureSession() {
        VoiceLiveSessionOptions options = new VoiceLiveSessionOptions();

        // Voice
        if ("openai".equals(config.getVoiceType())) {
            OpenAIVoice openAIVoice = new OpenAIVoice(OpenAIVoiceName.fromString(config.getVoice()));
            options.setVoice(BinaryData.fromObject(openAIVoice));
        } else {
            AzureStandardVoice azureVoice = new AzureStandardVoice(config.getVoice());
            options.setVoice(BinaryData.fromObject(azureVoice));
        }

        // VAD — map string type to SDK class
        TurnDetection vad = buildTurnDetection(config.getVadType());
        options.setTurnDetection(vad);

        // Modalities
        options.setModalities(List.of(InteractionModality.TEXT, InteractionModality.AUDIO));

        // Audio format
        options.setInputAudioFormat(InputAudioFormat.PCM16);
        options.setOutputAudioFormat(OutputAudioFormat.PCM16);

        // Temperature
        options.setTemperature(config.getTemperature());

        // Instructions (model mode only)
        if ("model".equals(config.getMode()) && config.getInstructions() != null
                && !config.getInstructions().isBlank()) {
            options.setInstructions(config.getInstructions());
        }

        // Echo cancellation & noise reduction
        if (config.isEchoCancellation()) {
            options.setInputAudioEchoCancellation(new AudioEchoCancellation());
        }
        if (config.isNoiseReduction()) {
            options.setInputAudioNoiseReduction(
                    new AudioNoiseReduction(AudioNoiseReductionType.AZURE_DEEP_NOISE_SUPPRESSION));
        }

        // Transcription
        AudioInputTranscriptionOptions transcription = new AudioInputTranscriptionOptions(
                AudioInputTranscriptionOptionsModel.fromString(config.getTranscribeModel()));
        if (config.getInputLanguage() != null && !config.getInputLanguage().isBlank()) {
            transcription.setLanguage(config.getInputLanguage());
        }
        options.setInputAudioTranscription(transcription);

        // Configure via typed API
        session.configureSession(options).block();

        logger.info("[{}] Session configured ({} mode, voice={}, vad={})",
                clientId, config.getMode(), config.getVoice(), config.getVadType());
    }

    private static TurnDetection buildTurnDetection(String vadType) {
        return switch (vadType) {
            case "azure_semantic_en" -> new AzureSemanticVadTurnDetectionEn();
            case "azure_semantic_multilingual" -> new AzureSemanticVadTurnDetectionMultilingual();
            case "server" -> new ServerVadTurnDetection();
            default -> new AzureSemanticVadTurnDetection(); // azure_semantic and fallback
        };
    }

    // ------------------------------------------------------------------
    // Proactive greeting helpers
    // ------------------------------------------------------------------

    private void sendLlmGeneratedGreeting() {
        if (session == null) return;
        try {
            String instruction = (config.getGreetingText() != null && !config.getGreetingText().isBlank())
                    ? config.getGreetingText()
                    : "Greet the user warmly and briefly explain how you can help. Start the conversation in English.";

            // Create a system message item with the greeting instruction
            SystemMessageItem item = new SystemMessageItem(
                    List.of(new InputTextContentPart(instruction)));
            session.addItem(item).block();

            // Trigger a response
            session.startResponse().block();

            logger.info("[{}] LLM-generated greeting triggered", clientId);
        } catch (Exception e) {
            logger.warn("[{}] LLM-generated greeting failed: {}", clientId, e.getMessage());
        }
    }

    private void sendPreGeneratedGreeting() {
        if (session == null) return;
        try {
            String text = (config.getGreetingText() != null && !config.getGreetingText().isBlank())
                    ? config.getGreetingText()
                    : "Welcome! I'm here to help you get started.";

            AssistantMessageItem preGenMsg = new AssistantMessageItem(
                    List.of(new OutputTextContentPart(text)));
            ResponseCreateParams params = new ResponseCreateParams()
                    .setPreGeneratedAssistantMessage(preGenMsg);

            session.startResponse(new VoiceLiveSessionOptions()).block();
            // Use raw JSON for pre-generated greeting since startResponse(VoiceLiveSessionOptions) doesn't accept ResponseCreateParams
            String json = String.format(
                    "{\"type\":\"response.create\",\"response\":{\"pre_generated_assistant_message\":{\"type\":\"message\",\"role\":\"assistant\",\"content\":[{\"type\":\"output_text\",\"text\":\"%s\"}]}}}",
                    escapeJson(text));
            session.send(BinaryData.fromString(json)).block();

            logger.info("[{}] Pre-generated greeting sent", clientId);
        } catch (Exception e) {
            logger.warn("[{}] Pre-generated greeting failed: {}", clientId, e.getMessage());
        }
    }

    // ------------------------------------------------------------------
    // Event handling
    // ------------------------------------------------------------------

    private void handleEvent(SessionUpdate event) {
        if (!running) return;
        try {
            ServerEventType type = event.getType();

            if (ServerEventType.SESSION_UPDATED.equals(type)) {
                handleSessionUpdated();
            } else if (ServerEventType.INPUT_AUDIO_BUFFER_SPEECH_STARTED.equals(type)) {
                handleSpeechStarted();
            } else if (ServerEventType.INPUT_AUDIO_BUFFER_SPEECH_STOPPED.equals(type)) {
                send("status", "state", "thinking");
            } else if (ServerEventType.RESPONSE_CREATED.equals(type)) {
                send("status", "state", "speaking");
            } else if (ServerEventType.RESPONSE_AUDIO_DELTA.equals(type)) {
                handleAudioDelta(event);
            } else if (ServerEventType.RESPONSE_AUDIO_DONE.equals(type)) {
                logger.debug("[{}] Audio response complete", clientId);
            } else if (ServerEventType.RESPONSE_DONE.equals(type)) {
                handleResponseDone();
            } else if (ServerEventType.CONVERSATION_ITEM_INPUT_AUDIO_TRANSCRIPTION_COMPLETED.equals(type)) {
                handleUserTranscript(event);
            } else if (ServerEventType.RESPONSE_AUDIO_TRANSCRIPT_DELTA.equals(type)) {
                handleAssistantTranscriptDelta(event);
            } else if (ServerEventType.ERROR.equals(type)) {
                handleError(event);
            }
        } catch (Exception e) {
            logger.error("[{}] Event handling error: {}", clientId, e.getMessage());
        }
    }

    private void handleSessionUpdated() {
        Map<String, Object> configMap = new HashMap<>();
        configMap.put("mode", config.getMode());
        configMap.put("model", config.getModel());
        configMap.put("voice", config.getVoice());

        Map<String, Object> msg = new HashMap<>();
        msg.put("type", "session_started");
        msg.put("config", configMap);
        sendMessage.accept(msg);

        send("status", "state", "listening");

        // Proactive greeting — trigger once per session, model mode only
        if (config.isProactiveGreeting() && !greetingSent && "model".equals(config.getMode())) {
            greetingSent = true;
            if ("pregenerated".equals(config.getGreetingType())) {
                sendPreGeneratedGreeting();
            } else {
                sendLlmGeneratedGreeting();
            }
        }
    }

    private void handleSpeechStarted() {
        send("status", "state", "listening");
        sendMessage.accept(Map.of("type", "stop_playback"));
        // Cancel any active response (barge-in)
        try {
            session.cancelResponse().block();
        } catch (Exception e) {
            // Ignore — no active response
        }
    }

    private void handleAudioDelta(SessionUpdate event) {
        try {
            if (event instanceof SessionUpdateResponseAudioDelta audioDelta) {
                byte[] delta = audioDelta.getDelta();
                if (delta != null && delta.length > 0) {
                    String audioB64 = Base64.getEncoder().encodeToString(delta);
                    Map<String, Object> msg = new HashMap<>();
                    msg.put("type", "audio_data");
                    msg.put("data", audioB64);
                    msg.put("format", "pcm16");
                    msg.put("sampleRate", 24000);
                    msg.put("channels", 1);
                    sendMessage.accept(msg);
                }
            }
        } catch (Exception e) {
            logger.error("[{}] Error processing audio delta: {}", clientId, e.getMessage());
        }
    }

    private void handleResponseDone() {
        // Flush accumulated assistant transcript as final
        if (assistantTranscript.length() > 0) {
            Map<String, Object> msg = new HashMap<>();
            msg.put("type", "transcript");
            msg.put("role", "assistant");
            msg.put("text", assistantTranscript.toString());
            msg.put("isFinal", true);
            sendMessage.accept(msg);
            assistantTranscript.setLength(0);
        }
        send("status", "state", "listening");
    }

    private void handleUserTranscript(SessionUpdate event) {
        try {
            if (event instanceof SessionUpdateConversationItemInputAudioTranscriptionCompleted transcriptEvent) {
                String transcript = transcriptEvent.getTranscript();
                if (transcript != null && !transcript.isBlank()) {
                    Map<String, Object> msg = new HashMap<>();
                    msg.put("type", "transcript");
                    msg.put("role", "user");
                    msg.put("text", transcript);
                    msg.put("isFinal", true);
                    sendMessage.accept(msg);
                }
            }
        } catch (Exception e) {
            logger.error("[{}] Error processing user transcript: {}", clientId, e.getMessage());
        }
    }

    private void handleAssistantTranscriptDelta(SessionUpdate event) {
        try {
            if (event instanceof SessionUpdateResponseAudioTranscriptDelta transcriptDelta) {
                String delta = transcriptDelta.getDelta();
                if (delta != null && !delta.isEmpty()) {
                    assistantTranscript.append(delta);
                    Map<String, Object> msg = new HashMap<>();
                    msg.put("type", "transcript");
                    msg.put("role", "assistant");
                    msg.put("text", assistantTranscript.toString());
                    msg.put("isFinal", false);
                    sendMessage.accept(msg);
                }
            }
        } catch (Exception e) {
            logger.error("[{}] Error processing assistant transcript delta: {}", clientId, e.getMessage());
        }
    }

    private void handleError(SessionUpdate event) {
        String message = "";
        String code = "";
        if (event instanceof SessionUpdateError errorEvent) {
            SessionUpdateErrorDetails details = errorEvent.getError();
            if (details != null) {
                message = details.getMessage() != null ? details.getMessage() : "";
                code = details.getCode() != null ? details.getCode() : "";
            }
        }
        if (message.isEmpty()) {
            message = event.toString();
        }

        // Benign cancellation errors — don't surface to client
        if ("response_cancel_not_active".equals(code) || message.toLowerCase().contains("no active response")) {
            logger.debug("[{}] Benign cancel error: {}", clientId, message);
            return;
        }
        logger.error("[{}] VoiceLive error event: {}", clientId, message);
        send("error", "message", message);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private void send(String type, String key, Object value) {
        sendMessage.accept(Map.of("type", type, key, value));
    }

    private static String escapeJson(String text) {
        return text.replace("\\", "\\\\")
                   .replace("\"", "\\\"")
                   .replace("\n", "\\n")
                   .replace("\r", "\\r")
                   .replace("\t", "\\t");
    }
}
