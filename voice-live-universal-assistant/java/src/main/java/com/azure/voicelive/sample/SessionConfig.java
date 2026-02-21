package com.azure.voicelive.sample;

import java.util.Optional;

/**
 * Application-level session configuration mirroring the Python SessionConfig.
 * Provides typed builder methods that return the appropriate SDK objects.
 */
public class SessionConfig {

    // Connection / mode
    private String mode = "agent";
    private String model = "gpt-realtime";
    private String voice = "en-US-Ava:DragonHDLatestNeural";
    private String voiceType = "azure-standard";
    private String instructions = "";
    private double temperature = 0.7;

    // Audio processing
    private String vadType = "azure_semantic";
    private boolean noiseReduction = true;
    private boolean echoCancellation = true;

    // Speech input
    private String transcribeModel = "gpt-4o-transcribe";
    private String inputLanguage = "";

    // Agent mode
    private String agentName;
    private String projectName;
    private String agentVersion;
    private String conversationId;
    private String foundryResourceOverride;
    private String authIdentityClientId;
    private String byomProfile;

    // Proactive engagement
    private boolean proactiveGreeting = true;
    private String greetingType = "llm";
    private String greetingText = "";

    // Interim response (KNOWN ISSUE: not supported in Java SDK beta.4)
    private boolean interimResponse = false;
    private String interimResponseType = "llm";
    private boolean interimTriggerTool = true;
    private boolean interimTriggerLatency = true;
    private int interimLatencyMs = 100;
    private String interimInstructions = "";
    private String interimStaticTexts = "";

    public SessionConfig() {}

    // -- Getters and setters -----------------------------------------------

    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }

    public String getVoice() { return voice; }
    public void setVoice(String voice) { this.voice = voice; }

    public String getVoiceType() { return voiceType; }
    public void setVoiceType(String voiceType) { this.voiceType = voiceType; }

    public String getInstructions() { return instructions; }
    public void setInstructions(String instructions) { this.instructions = instructions; }

    public double getTemperature() { return temperature; }
    public void setTemperature(double temperature) { this.temperature = temperature; }

    public String getVadType() { return vadType; }
    public void setVadType(String vadType) { this.vadType = vadType; }

    public boolean isNoiseReduction() { return noiseReduction; }
    public void setNoiseReduction(boolean noiseReduction) { this.noiseReduction = noiseReduction; }

    public boolean isEchoCancellation() { return echoCancellation; }
    public void setEchoCancellation(boolean echoCancellation) { this.echoCancellation = echoCancellation; }

    public String getTranscribeModel() { return transcribeModel; }
    public void setTranscribeModel(String transcribeModel) { this.transcribeModel = transcribeModel; }

    public String getInputLanguage() { return inputLanguage; }
    public void setInputLanguage(String inputLanguage) { this.inputLanguage = inputLanguage; }

    public String getAgentName() { return agentName; }
    public void setAgentName(String agentName) { this.agentName = agentName; }

    public String getProjectName() { return projectName; }
    public void setProjectName(String projectName) { this.projectName = projectName; }

    public String getAgentVersion() { return agentVersion; }
    public void setAgentVersion(String agentVersion) { this.agentVersion = agentVersion; }

    public String getConversationId() { return conversationId; }
    public void setConversationId(String conversationId) { this.conversationId = conversationId; }

    public String getFoundryResourceOverride() { return foundryResourceOverride; }
    public void setFoundryResourceOverride(String v) { this.foundryResourceOverride = v; }

    public String getAuthIdentityClientId() { return authIdentityClientId; }
    public void setAuthIdentityClientId(String v) { this.authIdentityClientId = v; }

    public String getByomProfile() { return byomProfile; }
    public void setByomProfile(String byomProfile) { this.byomProfile = byomProfile; }

    public boolean isProactiveGreeting() { return proactiveGreeting; }
    public void setProactiveGreeting(boolean v) { this.proactiveGreeting = v; }

    public String getGreetingType() { return greetingType; }
    public void setGreetingType(String greetingType) { this.greetingType = greetingType; }

    public String getGreetingText() { return greetingText; }
    public void setGreetingText(String greetingText) { this.greetingText = greetingText; }

    public boolean isInterimResponse() { return interimResponse; }
    public void setInterimResponse(boolean v) { this.interimResponse = v; }

    public String getInterimResponseType() { return interimResponseType; }
    public void setInterimResponseType(String v) { this.interimResponseType = v; }

    public boolean isInterimTriggerTool() { return interimTriggerTool; }
    public void setInterimTriggerTool(boolean v) { this.interimTriggerTool = v; }

    public boolean isInterimTriggerLatency() { return interimTriggerLatency; }
    public void setInterimTriggerLatency(boolean v) { this.interimTriggerLatency = v; }

    public int getInterimLatencyMs() { return interimLatencyMs; }
    public void setInterimLatencyMs(int v) { this.interimLatencyMs = v; }

    public String getInterimInstructions() { return interimInstructions; }
    public void setInterimInstructions(String v) { this.interimInstructions = v; }

    public String getInterimStaticTexts() { return interimStaticTexts; }
    public void setInterimStaticTexts(String v) { this.interimStaticTexts = v; }

    // -- Helpers -----------------------------------------------------------

    /**
     * Get a non-null, non-blank optional — returns empty if the value is null or blank.
     */
    public static Optional<String> optionalNonBlank(String value) {
        return (value != null && !value.isBlank()) ? Optional.of(value) : Optional.empty();
    }
}
