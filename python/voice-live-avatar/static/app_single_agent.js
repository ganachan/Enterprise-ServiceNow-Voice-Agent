/**
 * Voice Live Avatar - Client-side JavaScript
 * Handles audio capture (AudioWorklet 24kHz PCM16), WebSocket communication,
 * WebRTC avatar video, and UI state management.
 */

// ===== State =====
let ws = null;
let audioContext = null;
let workletNode = null;
let mediaStream = null;
let playbackContext = null;
let playbackBufferQueue = [];
let nextPlaybackTime = 0;
let isConnected = false;
let isConnecting = false;
let isRecording = false;
let audioChunksSent = 0;
let isDeveloperMode = false;
let avatarEnabled = false;
let peerConnection = null;
let avatarVideoElement = null;
let isSpeaking = false;
let avatarOutputMode = 'webrtc';
let cachedIceServers = null;
let peerConnectionQueue = [];

// Volume animation state
let analyserNode = null;
let analyserDataArray = null;
let micAnalyserNode = null;
let micAnalyserDataArray = null;
let recordAnimationFrameId = null;
let playChunkAnimationFrameId = null;

// WebSocket video playback (MediaSource Extensions)
let mediaSource = null;
let sourceBuffer = null;
let videoChunksQueue = [];
let pendingWsVideoElement = null;

const clientId = 'client-' + Math.random().toString(36).substr(2, 9);

// ===== ServiceNow Tools =====
const SNOW_API_BASE = "https://snow-mcp-server.braveglacier-396ec991.westus2.azurecontainerapps.io";

const SNOW_TOOLS_DEFS = [
    {
        id: "snow_nowtest",
        label: "🔌 Test Connection",
        tool: {
            type: "function",
            name: "nowtest",
            parameters: null,
            description: "Test that the ServiceNow MCP server is running and ready.",
        },
    },
    {
        id: "snow_listIncidents",
        label: "📋 List Incidents",
        tool: {
            type: "function",
            name: "listIncidents",
            parameters: {
                type: "object",
                properties: {
                    state: { type: "string", description: "1=New, 2=In Progress, 3=On Hold, 6=Resolved, 7=Closed" },
                    priority: { type: "string", description: "1=Critical, 2=High, 3=Moderate, 4=Low" },
                    limit: { type: "integer", description: "Max results (default 10)" },
                },
                additionalProperties: false,
            },
            description: "List ServiceNow incidents with optional filters by state and priority.",
        },
    },
    {
        id: "snow_getIncident",
        label: "🔍 Get Incident",
        tool: {
            type: "function",
            name: "getIncident",
            parameters: {
                type: "object",
                properties: {
                    incidentNumber: { type: "string", description: "Incident number e.g. INC0010001" },
                },
                required: ["incidentNumber"],
                additionalProperties: false,
            },
            description: "Get full details of a specific ServiceNow incident by number.",
        },
    },
    {
        id: "snow_createIncident",
        label: "➕ Create Incident",
        tool: {
            type: "function",
            name: "createIncident",
            parameters: {
                type: "object",
                properties: {
                    short_description: { type: "string", description: "Brief summary (required)" },
                    description: { type: "string", description: "Detailed description" },
                    priority: { type: "string", description: "1=Critical, 2=High, 3=Moderate, 4=Low" },
                    category: { type: "string", description: "software, hardware, network" },
                    caller_id: { type: "string", description: "Username of caller" },
                },
                required: ["short_description"],
                additionalProperties: false,
            },
            description: "Create a new ServiceNow incident. Always confirm with user before creating.",
        },
    },
    {
        id: "snow_updateIncident",
        label: "✏️ Update Incident",
        tool: {
            type: "function",
            name: "updateIncident",
            parameters: {
                type: "object",
                properties: {
                    incidentNumber: { type: "string", description: "Incident number e.g. INC0010001" },
                    short_description: { type: "string" },
                    description: { type: "string" },
                    state: { type: "string", description: "1=New, 2=In Progress, 3=On Hold, 6=Resolved, 7=Closed" },
                    priority: { type: "string", description: "1=Critical, 2=High, 3=Moderate, 4=Low" },
                    assigned_to: { type: "string" },
                    work_notes: { type: "string" },
                },
                required: ["incidentNumber"],
                additionalProperties: false,
            },
            description: "Update an existing ServiceNow incident. Always confirm before updating.",
        },
    },
    {
        id: "snow_resolveIncident",
        label: "✅ Resolve Incident",
        tool: {
            type: "function",
            name: "resolveIncident",
            parameters: {
                type: "object",
                properties: {
                    incidentNumber: { type: "string", description: "Incident number e.g. INC0010001" },
                    resolution_notes: { type: "string", description: "How the incident was resolved" },
                },
                required: ["incidentNumber", "resolution_notes"],
                additionalProperties: false,
            },
            description: "Resolve a ServiceNow incident with resolution notes.",
        },
    },
    {
        id: "snow_addComment",
        label: "💬 Add Comment",
        tool: {
            type: "function",
            name: "addCommentToIncident",
            parameters: {
                type: "object",
                properties: {
                    incidentNumber: { type: "string", description: "Incident number e.g. INC0010001" },
                    comment: { type: "string", description: "Comment text to add" },
                },
                required: ["incidentNumber", "comment"],
                additionalProperties: false,
            },
            description: "Add a work note or comment to a ServiceNow incident.",
        },
    },
    {
        id: "snow_searchIncidents",
        label: "🔎 Search Incidents",
        tool: {
            type: "function",
            name: "similarincidentsfortext",
            parameters: {
                type: "object",
                properties: {
                    inputText: { type: "string", description: "Keywords to search in incident descriptions" },
                },
                required: ["inputText"],
                additionalProperties: false,
            },
            description: "Search ServiceNow incidents by keyword in short description.",
        },
    },
    {
        id: "snow_getUser",
        label: "👤 Get User",
        tool: {
            type: "function",
            name: "getUser",
            parameters: {
                type: "object",
                properties: {
                    username: { type: "string", description: "Username e.g. admin, john.doe" },
                },
                required: ["username"],
                additionalProperties: false,
            },
            description: "Look up a ServiceNow user by username.",
        },
    },
    {
        id: "snow_listUsers",
        label: "👥 List Users",
        tool: {
            type: "function",
            name: "listUsers",
            parameters: {
                type: "object",
                properties: {
                    limit: { type: "integer", description: "Max users to return (default 10)" },
                },
                additionalProperties: false,
            },
            description: "List active ServiceNow users.",
        },
    },
    {
        id: "snow_getCMDB",
        label: "🖥️ CMDB Lookup",
        tool: {
            type: "function",
            name: "getCMDBItem",
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string", description: "Name of the Configuration Item to search" },
                },
                required: ["name"],
                additionalProperties: false,
            },
            description: "Look up a Configuration Item (CI) in the ServiceNow CMDB.",
        },
    },
];

// All tools enabled by default
let enabledSnowTools = Object.fromEntries(SNOW_TOOLS_DEFS.map(t => [t.id, true]));

function getEnabledSnowTools() {
    return SNOW_TOOLS_DEFS.filter(t => enabledSnowTools[t.id]).map(t => t.tool);
}

function renderSnowToolsUI() {
    const container = document.getElementById('snowToolsContainer');
    if (!container) return;
    container.innerHTML = `
        <div style="border:1px solid #ddd;border-radius:6px;overflow:hidden;margin-top:4px;">
            <div style="padding:6px 10px;background:#eff6ff;border-bottom:1px solid #ddd;">
                <div style="font-size:11px;font-weight:600;color:#1d4ed8;">🔧 Azure Container App</div>
                <div style="font-size:10px;color:#3b82f6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${SNOW_API_BASE}</div>
            </div>
            <div style="max-height:220px;overflow-y:auto;">
                ${SNOW_TOOLS_DEFS.map(t => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 10px;border-bottom:1px solid #f3f4f6;">
                    <label for="${t.id}_tog" style="font-size:12px;cursor:pointer;flex:1;user-select:none;">${t.label}</label>
                    <input type="checkbox" id="${t.id}_tog" ${enabledSnowTools[t.id] ? 'checked' : ''}
                        onchange="enabledSnowTools['${t.id}']=this.checked;updateSnowToolCount();"
                        style="width:16px;height:16px;cursor:pointer;flex-shrink:0;">
                </div>`).join('')}
            </div>
            <div style="padding:4px 10px;background:#f9fafb;border-top:1px solid #ddd;">
                <span id="snowToolCount" style="font-size:11px;color:#6b7280;"></span>
            </div>
        </div>`;
    updateSnowToolCount();
}

function updateSnowToolCount() {
    const el = document.getElementById('snowToolCount');
    if (!el) return;
    const count = Object.values(enabledSnowTools).filter(Boolean).length;
    el.textContent = `${count} / ${SNOW_TOOLS_DEFS.length} tools enabled`;
}

// ===== DOM Ready =====
document.addEventListener('DOMContentLoaded', () => {
    setupUIBindings();
    updateConditionalFields();
    updateControlStates();
    fetchServerConfig();
    renderSnowToolsUI();
});

// ===== Server Config =====
async function fetchServerConfig() {
    try {
        const resp = await fetch('/api/config');
        const config = await resp.json();
        if (config.endpoint) document.getElementById('endpoint').value = config.endpoint;
        if (config.model) document.getElementById('model').value = config.model;
        if (config.voice) document.getElementById('voiceName').value = config.voice;
    } catch (e) {
        console.log('No server config available, using defaults');
    }
}

// ===== UI Bindings =====
function setupUIBindings() {
    document.getElementById('mode').addEventListener('change', updateConditionalFields);
    document.getElementById('model').addEventListener('change', updateConditionalFields);
    document.getElementById('voiceType').addEventListener('change', updateConditionalFields);
    document.getElementById('voiceName').addEventListener('change', updateConditionalFields);
    document.getElementById('avatarEnabled').addEventListener('change', updateConditionalFields);
    document.getElementById('isPhotoAvatar').addEventListener('change', updateConditionalFields);
    document.getElementById('isCustomAvatar').addEventListener('change', updateConditionalFields);
    document.getElementById('developerMode').addEventListener('change', (e) => {
        isDeveloperMode = e.target.checked;
        updateDeveloperModeLayout();
    });
    document.getElementById('turnDetectionType').addEventListener('change', updateConditionalFields);
    document.getElementById('srModel').addEventListener('change', updateConditionalFields);

    setupRangeDisplay('temperature', 'tempValue', v => v);
    setupRangeDisplay('voiceTemperature', 'voiceTempValue', v => v);
    setupRangeDisplay('voiceSpeed', 'voiceSpeedValue', v => v + '%');
    setupRangeDisplay('sceneZoom', 'sceneZoomLabel', v => 'Zoom: ' + v + '%');
    setupRangeDisplay('scenePositionX', 'scenePositionXLabel', v => 'Position X: ' + v + '%');
    setupRangeDisplay('scenePositionY', 'scenePositionYLabel', v => 'Position Y: ' + v + '%');
    setupRangeDisplay('sceneRotationX', 'sceneRotationXLabel', v => 'Rotation X: ' + v + ' deg');
    setupRangeDisplay('sceneRotationY', 'sceneRotationYLabel', v => 'Rotation Y: ' + v + ' deg');
    setupRangeDisplay('sceneRotationZ', 'sceneRotationZLabel', v => 'Rotation Z: ' + v + ' deg');
    setupRangeDisplay('sceneAmplitude', 'sceneAmplitudeLabel', v => 'Amplitude: ' + v + '%');

    const sceneSliders = ['sceneZoom', 'scenePositionX', 'scenePositionY',
        'sceneRotationX', 'sceneRotationY', 'sceneRotationZ', 'sceneAmplitude'];
    sceneSliders.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', throttledUpdateAvatarScene);
    });

    const settingsGroups = document.querySelectorAll('.sidebar .settings-group');
    settingsGroups.forEach(group => {
        group.addEventListener('toggle', () => {
            if (group.open) {
                settingsGroups.forEach(other => {
                    if (other !== group && other.open) other.removeAttribute('open');
                });
            }
        });
    });
}

function setupRangeDisplay(sliderId, displayId, formatter) {
    const slider = document.getElementById(sliderId);
    const display = document.getElementById(displayId);
    if (slider && display) {
        slider.addEventListener('input', () => { display.textContent = formatter(slider.value); });
    }
}

// ===== Photo Avatar Scene Update =====
let lastSceneUpdate = 0;
const SCENE_THROTTLE_MS = 50;

function throttledUpdateAvatarScene() {
    const now = Date.now();
    if (now - lastSceneUpdate < SCENE_THROTTLE_MS) return;
    lastSceneUpdate = now;
    updateAvatarScene();
}

function updateAvatarScene() {
    if (!isConnected || !ws || ws.readyState !== WebSocket.OPEN) return;
    if (!document.getElementById('isPhotoAvatar')?.checked) return;
    if (!document.getElementById('avatarEnabled')?.checked) return;

    const isCustom = document.getElementById('isCustomAvatar')?.checked || false;
    const avatarName = isCustom
        ? document.getElementById('customAvatarName')?.value || ''
        : document.getElementById('photoAvatarName')?.value || 'Anika';
    const parts = avatarName.split('-');
    const character = parts[0].toLowerCase();
    const style = parts.slice(1).join('-') || undefined;

    const scene = {
        zoom: parseInt(document.getElementById('sceneZoom').value) / 100,
        position_x: parseInt(document.getElementById('scenePositionX').value) / 100,
        position_y: parseInt(document.getElementById('scenePositionY').value) / 100,
        rotation_x: parseInt(document.getElementById('sceneRotationX').value) * Math.PI / 180,
        rotation_y: parseInt(document.getElementById('sceneRotationY').value) * Math.PI / 180,
        rotation_z: parseInt(document.getElementById('sceneRotationZ').value) * Math.PI / 180,
        amplitude: parseInt(document.getElementById('sceneAmplitude').value) / 100,
    };

    const avatar = { type: 'photo-avatar', model: 'vasa-1', character, scene };
    if (isCustom) avatar.customized = true;
    else if (style) avatar.style = style;

    ws.send(JSON.stringify({ type: 'update_scene', avatar }));
}

// ===== Conditional Field Visibility =====
function updateConditionalFields() {
    const mode = document.getElementById('mode').value;
    const model = document.getElementById('model').value;
    const voiceType = document.getElementById('voiceType').value;
    const voiceName = document.getElementById('voiceName').value;
    const avatarEnabled = document.getElementById('avatarEnabled').checked;
    const isPhotoAvatar = document.getElementById('isPhotoAvatar').checked;
    const isCustomAvatar = document.getElementById('isCustomAvatar').checked;
    const turnDetectionType = document.getElementById('turnDetectionType').value;
    const srModel = document.getElementById('srModel').value;

    const cascadedModels = ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini', 'phi4-mm', 'phi4-mini'];
    const isCascaded = cascadedModels.includes(model);
    const isAgent = mode === 'agent' || mode === 'agent-v2';

    show('agentFields', isAgent);
    show('modelField', !isAgent);
    show('instructionsField', !isAgent);
    show('temperatureField', !isAgent);
    show('agentIdField', mode === 'agent');
    show('agentNameField', mode === 'agent-v2');
    show('subscriptionKeyField', !isAgent);
    show('entraTokenField', isAgent);
    show('srModelField', !isAgent && isCascaded);
    show('recognitionLanguageField', !isAgent && isCascaded && srModel !== 'mai-ears-1');
    show('eouDetectionField', !isAgent && isCascaded);
    show('fillerWordsField', turnDetectionType === 'azure_semantic_vad');
    show('standardVoiceField', voiceType === 'standard');
    show('customVoiceFields', voiceType === 'custom');
    show('personalVoiceFields', voiceType === 'personal');

    const isDragonHD = voiceName && voiceName.includes('DragonHD');
    const isPersonal = voiceType === 'personal';
    show('voiceTempField', isDragonHD || isPersonal);
    show('avatarSettings', avatarEnabled);
    show('standardAvatarField', !isPhotoAvatar && !isCustomAvatar);
    show('photoAvatarField', isPhotoAvatar && !isCustomAvatar);
    show('customAvatarField', isCustomAvatar);
    show('photoAvatarSceneSettings', isPhotoAvatar);

    // Show ServiceNow tools only in model mode
    show('snowToolsField', !isAgent);
}

function show(id, visible) {
    const el = document.getElementById(id);
    if (el) el.style.display = visible ? '' : 'none';
}

// ===== Sidebar Toggle (mobile) =====
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ===== Chat =====
function addMessage(role, text, isDev = false) {
    if (isDev && !isDeveloperMode) return;
    const messagesEl = document.getElementById('messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isDev ? 'dev' : role}`;

    if (!isDev) {
        const roleSpan = document.createElement('div');
        roleSpan.className = 'message-role';
        roleSpan.textContent = role === 'user' ? 'You' : role === 'assistant' ? 'Assistant' : 'System';
        msgDiv.appendChild(roleSpan);
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = text;
    msgDiv.appendChild(contentDiv);

    messagesEl.appendChild(msgDiv);
    scrollChatToBottom();
    updateClearChatButton();
    return contentDiv;
}

function updateLastAssistantMessage(text) {
    const messages = document.querySelectorAll('.message.assistant .message-content');
    if (messages.length > 0) {
        messages[messages.length - 1].textContent = text;
        scrollChatToBottom();
    }
}

function scrollChatToBottom() {
    const chatArea = document.getElementById('chatArea');
    chatArea.scrollTop = chatArea.scrollHeight;
}

function clearChat() {
    const messages = document.getElementById('messages');
    if (messages.children.length === 0) return;
    messages.innerHTML = '';
    updateClearChatButton();
}

function updateClearChatButton() {
    const btn = document.getElementById('clearChatBtn');
    const messages = document.getElementById('messages');
    if (!btn || !messages) return;
    const hasMessages = messages.children.length > 0;
    btn.disabled = !hasMessages;
    btn.style.opacity = hasMessages ? '' : '0.5';
}

// ===== Gather Config =====
function gatherConfig() {
    const mode = document.getElementById('mode').value;
    const model = document.getElementById('model').value;
    const voiceType = document.getElementById('voiceType').value;
    const isPhotoAvatar = document.getElementById('isPhotoAvatar').checked;
    const isCustomAvatar = document.getElementById('isCustomAvatar').checked;
    const voiceSpeed = parseFloat(document.getElementById('voiceSpeed').value) / 100;

    const config = {
        mode,
        model,
        voiceType,
        voiceName: document.getElementById('voiceName').value,
        voiceSpeed,
        voiceTemperature: parseFloat(document.getElementById('voiceTemperature').value),
        voiceDeploymentId: document.getElementById('voiceDeploymentId').value,
        customVoiceName: document.getElementById('customVoiceName').value,
        personalVoiceName: document.getElementById('personalVoiceName').value,
        personalVoiceModel: document.getElementById('personalVoiceModel').value,
        avatarEnabled: document.getElementById('avatarEnabled').checked,
        isPhotoAvatar,
        isCustomAvatar,
        avatarName: isCustomAvatar
            ? document.getElementById('customAvatarName').value
            : isPhotoAvatar
                ? document.getElementById('photoAvatarName').value
                : document.getElementById('avatarName').value,
        avatarOutputMode: document.getElementById('avatarOutputMode').value,
        avatarBackgroundImageUrl: document.getElementById('avatarBackgroundImageUrl').value,
        useNS: document.getElementById('useNS').checked,
        useEC: document.getElementById('useEC').checked,
        turnDetectionType: document.getElementById('turnDetectionType').value,
        removeFillerWords: document.getElementById('removeFillerWords').checked,
        srModel: document.getElementById('srModel').value,
        recognitionLanguage: document.getElementById('recognitionLanguage').value,
        eouDetectionType: document.getElementById('eouDetectionType').value,
        instructions: document.getElementById('instructions').value,
        temperature: parseFloat(document.getElementById('temperature').value),
        enableProactive: document.getElementById('enableProactive').checked,
        agentId: document.getElementById('agentId').value,
        agentName: document.getElementById('agentName').value,
        agentProjectName: document.getElementById('agentProjectName').value,
        // ServiceNow tools
        tools: getEnabledSnowTools(),
        snowApiBase: SNOW_API_BASE,
    };

    if (isPhotoAvatar) {
        config.photoScene = {
            zoom: parseInt(document.getElementById('sceneZoom').value),
            positionX: parseInt(document.getElementById('scenePositionX').value),
            positionY: parseInt(document.getElementById('scenePositionY').value),
            rotationX: parseInt(document.getElementById('sceneRotationX').value),
            rotationY: parseInt(document.getElementById('sceneRotationY').value),
            rotationZ: parseInt(document.getElementById('sceneRotationZ').value),
            amplitude: parseInt(document.getElementById('sceneAmplitude').value),
        };
    }

    return config;
}

// ===== Connection =====
async function toggleConnection() {
    if (isConnecting) return;
    if (isConnected) await disconnect();
    else await connectSession();
}

async function connectSession() {
    const endpoint = document.getElementById('endpoint').value.trim();
    const mode = document.getElementById('mode').value;
    const isAgent = mode === 'agent' || mode === 'agent-v2';

    if (!endpoint) { addMessage('system', 'Please enter Azure AI Services Endpoint'); return; }

    const apiKey = document.getElementById('apiKey')?.value.trim();
    const entraToken = document.getElementById('entraToken')?.value.trim();

    if (!isAgent && !apiKey) { addMessage('system', 'Please enter Subscription Key'); return; }
    if (isAgent && !entraToken) { addMessage('system', 'Please enter Entra ID Token'); return; }

    setConnecting(true);
    addMessage('system', 'Session started, click on the mic button to start conversation! debug id: connecting...');

    try {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${location.host}/ws/${clientId}`);

        ws.onopen = () => {
            const config = gatherConfig();
            config.endpoint = endpoint;
            if (isAgent) config.entraToken = entraToken;
            else config.apiKey = apiKey;
            ws.send(JSON.stringify({ type: 'start_session', config }));
        };

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            handleServerMessage(msg);
        };

        ws.onerror = (err) => {
            console.error('WebSocket error', err);
            addMessage('system', 'WebSocket error');
            setConnecting(false);
        };

        ws.onclose = () => {
            console.log('WebSocket closed');
            if (isConnected) addMessage('system', 'Disconnected');
            handleDisconnect();
        };
    } catch (err) {
        console.error('Connection error', err);
        addMessage('system', 'Failed to connect: ' + err.message);
        setConnecting(false);
    }
}

async function disconnect() {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'stop_session' }));
    handleDisconnect();
}

function handleDisconnect() {
    isConnected = false;
    isConnecting = false;
    isRecording = false;
    audioChunksSent = 0;
    avatarEnabled = false;

    stopAudioCapture();
    stopAudioPlayback();
    cleanupWebRTC();
    cleanupWebSocketVideo();
    updateSoundWaveAnimation();

    if (cachedIceServers) preparePeerConnection(cachedIceServers);

    if (ws) { try { ws.close(); } catch (e) {} ws = null; }

    updateConnectionUI();
    updateDeveloperModeLayout();
}

// ===== Handle Server Messages =====
function handleServerMessage(msg) {
    const type = msg.type;
    switch (type) {
        case 'session_started': onSessionStarted(msg); break;
        case 'session_error':
            addMessage('system', 'Error: ' + (msg.error || 'Unknown error'));
            setConnecting(false);
            break;
        case 'ice_servers':
            if (avatarOutputMode === 'webrtc') setupWebRTC(msg.iceServers);
            break;
        case 'avatar_sdp_answer': handleAvatarSdpAnswer(msg.serverSdp); break;
        case 'audio_data': handleAudioDelta(msg.data); break;
        case 'transcript_done':
            if (msg.role === 'user') {
                const itemId = msg.itemId;
                if (itemId) {
                    const existing = document.querySelector(`.message.user[data-item-id="${itemId}"] .message-content`);
                    if (existing) { existing.textContent = msg.transcript; scrollChatToBottom(); break; }
                }
                addMessage('user', msg.transcript);
            } else if (msg.role === 'assistant') {
                if (msg.transcript) {
                    const assistantMsgs = document.querySelectorAll('.message.assistant .message-content');
                    if (assistantMsgs.length > 0) assistantMsgs[assistantMsgs.length - 1].textContent = msg.transcript;
                    pendingAssistantText = '';
                }
            }
            break;
        case 'transcript_delta':
            if (msg.role === 'assistant') onAssistantDelta(msg.delta);
            break;
        case 'text_delta': onAssistantDelta(msg.delta); break;
        case 'text_done': break;
        case 'speech_started': onSpeechStarted(msg.itemId); break;
        case 'speech_stopped': onSpeechStopped(); break;
        case 'response_created':
            pendingAssistantText = '';
            addMessage('assistant', '');
            isSpeaking = true;
            break;
        case 'response_done':
            isSpeaking = false;
            break;
        case 'session_closed':
            addMessage('system', 'Session closed');
            handleDisconnect();
            break;
        case 'avatar_connecting': addMessage('system', 'Avatar connecting...'); break;
        case 'video_data': handleVideoChunk(msg.delta); break;
        case 'function_call_started':
            addMessage('system', `🔧 Calling ServiceNow: ${msg.functionName}...`);
            break;
        case 'function_call_result':
            console.log(`ServiceNow result [${msg.functionName}]:`, msg.result);
            break;
        case 'function_call_error':
            addMessage('system', `❌ ServiceNow error [${msg.functionName}]: ${msg.error}`);
            break;
        default:
            if (isDeveloperMode) console.log('Unhandled:', type, msg);
    }
}

let pendingAssistantText = '';

function onAssistantDelta(text) {
    pendingAssistantText += text;
    const messages = document.querySelectorAll('.message.assistant .message-content');
    if (messages.length > 0) {
        messages[messages.length - 1].textContent = pendingAssistantText;
        scrollChatToBottom();
    } else {
        addMessage('assistant', pendingAssistantText);
    }
}

async function onSessionStarted(msg) {
    isConnected = true;
    isConnecting = false;
    updateConnectionUI();

    const sessionId = msg.sessionId || '';
    const statusMessages = document.querySelectorAll('.message.system .message-content');
    for (const el of statusMessages) {
        if (el.textContent.includes('debug id: connecting...')) {
            el.textContent = `Session started, click on the mic button to start conversation! debug id: ${sessionId || 'unknown'}`;
            break;
        }
    }

    avatarEnabled = msg.config?.avatarEnabled || false;
    avatarOutputMode = msg.config?.avatarOutputMode || 'webrtc';
    const isPhotoAvatarSession = document.getElementById('isPhotoAvatar')?.checked || false;
    const avatarContainer = document.getElementById('avatarVideoContainer');
    if (avatarContainer) avatarContainer.classList.toggle('photo-avatar', isPhotoAvatarSession);
    updateDeveloperModeLayout();

    if (avatarEnabled && avatarOutputMode === 'websocket') setupWebSocketVideoPlayback(isPhotoAvatarSession);

    document.getElementById('recordContainer').style.display = '';
    await startAudioCapture();
    isRecording = false;
    stopRecordAnimation();
    resetVolumeCircle();
    updateMicUI();
}

// ===== UI State =====
function setConnecting(connecting) {
    isConnecting = connecting;
    updateConnectionUI();
}

function updateConnectionUI() {
    const btn = document.getElementById('connectBtn');
    const text = document.getElementById('connectBtnText');
    btn.classList.remove('connected', 'connecting');
    if (isConnected) { btn.classList.add('connected'); text.textContent = 'Disconnect'; }
    else if (isConnecting) { btn.classList.add('connecting'); text.textContent = 'Connecting...'; }
    else { text.textContent = 'Connect'; }
    btn.disabled = isConnecting;
    const sceneTitle = document.getElementById('sceneSettingsTitle');
    if (sceneTitle) sceneTitle.textContent = isConnected ? 'Scene Settings (Live Adjustable)' : 'Scene Settings';
    updateControlStates();
    updateMicUI();
}

const SETTINGS_CONTROLS = [
    'mode', 'endpoint', 'apiKey', 'entraToken',
    'agentProjectName', 'agentId', 'agentName', 'model',
    'srModel', 'recognitionLanguage',
    'useNS', 'useEC', 'turnDetectionType', 'removeFillerWords',
    'eouDetectionType', 'instructions', 'enableProactive',
    'temperature', 'voiceTemperature', 'voiceSpeed',
    'voiceType', 'voiceDeploymentId', 'customVoiceName',
    'personalVoiceName', 'personalVoiceModel', 'voiceName',
    'avatarEnabled', 'isPhotoAvatar', 'avatarOutputMode',
    'isCustomAvatar', 'avatarName', 'photoAvatarName',
    'customAvatarName', 'avatarBackgroundImageUrl',
];

const CHAT_CONTROLS = ['textInput'];

function updateControlStates() {
    for (const id of SETTINGS_CONTROLS) {
        const el = document.getElementById(id);
        if (el) el.disabled = isConnected;
    }
    for (const id of CHAT_CONTROLS) {
        const el = document.getElementById(id);
        if (el) el.disabled = !isConnected;
    }
    // Disable ServiceNow toggles when connected
    SNOW_TOOLS_DEFS.forEach(t => {
        const el = document.getElementById(`${t.id}_tog`);
        if (el) el.disabled = isConnected;
    });
    const micBtn = document.getElementById('micBtn');
    if (micBtn) micBtn.disabled = !isConnected;
    const sendBtns = document.querySelectorAll('.send-btn');
    sendBtns.forEach(btn => btn.disabled = !isConnected);
    const recordBtn = document.getElementById('recordBtn');
    if (recordBtn) recordBtn.disabled = !isConnected;
}

function updateDeveloperModeLayout() {
    const contentArea = document.getElementById('contentArea');
    const avatarVideoContainer = document.getElementById('avatarVideoContainer');
    const volumeAnimation = document.getElementById('volumeAnimation');
    const chatArea = document.getElementById('chatArea');
    const inputArea = document.getElementById('inputArea');
    const footerArea = document.getElementById('footerArea');

    if (isDeveloperMode) {
        inputArea.style.display = '';
        footerArea.style.display = 'none';
        if (isConnected && avatarEnabled) {
            contentArea.classList.add('developer-layout');
            avatarVideoContainer.style.display = '';
            chatArea.style.display = '';
            volumeAnimation.style.display = 'none';
        } else if (isConnected) {
            contentArea.classList.add('developer-layout');
            avatarVideoContainer.style.display = 'none';
            chatArea.style.display = '';
            volumeAnimation.style.display = '';
        } else {
            contentArea.classList.remove('developer-layout');
            avatarVideoContainer.style.display = 'none';
            chatArea.style.display = '';
            volumeAnimation.style.display = 'none';
        }
    } else {
        inputArea.style.display = 'none';
        footerArea.style.display = '';
        contentArea.classList.remove('developer-layout');
        if (isConnected && avatarEnabled) {
            avatarVideoContainer.style.display = '';
            chatArea.style.display = 'none';
            volumeAnimation.style.display = 'none';
        } else if (isConnected) {
            avatarVideoContainer.style.display = 'none';
            chatArea.style.display = 'none';
            volumeAnimation.style.display = '';
        } else {
            avatarVideoContainer.style.display = 'none';
            chatArea.style.display = '';
            volumeAnimation.style.display = 'none';
        }
    }
}

let soundWaveIntervalId = null;

function updateSoundWaveAnimation() {
    const leftWave = document.getElementById('soundWaveLeft');
    const rightWave = document.getElementById('soundWaveRight');
    if (isConnected && avatarEnabled && isRecording && !isDeveloperMode) {
        if (leftWave && leftWave.children.length === 0) {
            for (let i = 0; i < 10; i++) {
                const bar = document.createElement('div');
                bar.className = 'bar'; bar.id = `item-${i}`; bar.style.height = '2px';
                leftWave.appendChild(bar);
            }
        }
        if (rightWave && rightWave.children.length === 0) {
            for (let i = 10; i < 20; i++) {
                const bar = document.createElement('div');
                bar.className = 'bar'; bar.id = `item-${i}`; bar.style.height = '2px';
                rightWave.appendChild(bar);
            }
        }
        if (!soundWaveIntervalId) {
            soundWaveIntervalId = setInterval(() => {
                for (let i = 0; i < 20; i++) {
                    const ele = document.getElementById(`item-${i}`);
                    const height = 50 * Math.sin((Math.PI / 20) * i) * Math.random();
                    if (ele) { ele.style.transition = 'height 0.15s ease'; ele.style.height = `${Math.max(2, height)}px`; }
                }
            }, 150);
        }
        if (leftWave) leftWave.style.display = '';
        if (rightWave) rightWave.style.display = '';
    } else {
        if (soundWaveIntervalId) { clearInterval(soundWaveIntervalId); soundWaveIntervalId = null; }
        if (leftWave) leftWave.style.display = 'none';
        if (rightWave) rightWave.style.display = 'none';
    }
}

function updateMicUI() {
    const micBtn = document.getElementById('micBtn');
    const recordBtn = document.getElementById('recordBtn');
    if (micBtn) micBtn.classList.toggle('recording', isRecording);
    if (recordBtn) recordBtn.classList.toggle('recording', isRecording);
    document.querySelectorAll('.mic-off-icon').forEach(el => { el.style.display = isRecording ? 'none' : ''; });
    document.querySelectorAll('.mic-on-icon').forEach(el => { el.style.display = isRecording ? '' : 'none'; });
    const label = document.querySelector('.microphone-label');
    if (label) label.textContent = isRecording ? 'Turn off microphone' : 'Turn on microphone';
    updateSoundWaveAnimation();
}

// ===== Audio Capture (24kHz PCM16 via AudioWorklet) =====
async function startAudioCapture() {
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: { channelCount: 1, sampleRate: 24000, echoCancellation: true, noiseSuppression: true }
        });
        audioContext = new AudioContext({ sampleRate: 24000 });
        console.log('[Audio] AudioContext created, actual sampleRate:', audioContext.sampleRate);

        const processorCode = `
class PCM16Processor extends AudioWorkletProcessor {
    constructor() { super(); this.bufferSize = 2400; this.buffer = new Float32Array(this.bufferSize); this.offset = 0; }
    process(inputs) {
        const input = inputs[0];
        if (!input || !input[0]) return true;
        const data = input[0];
        for (let i = 0; i < data.length; i++) {
            this.buffer[this.offset++] = data[i];
            if (this.offset >= this.bufferSize) {
                const pcm16 = new Int16Array(this.bufferSize);
                for (let j = 0; j < this.bufferSize; j++) {
                    const s = Math.max(-1, Math.min(1, this.buffer[j]));
                    pcm16[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }
                this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
                this.buffer = new Float32Array(this.bufferSize);
                this.offset = 0;
            }
        }
        return true;
    }
}
registerProcessor('pcm16-processor', PCM16Processor);`;
        const blob = new Blob([processorCode], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        await audioContext.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);

        const source = audioContext.createMediaStreamSource(mediaStream);
        workletNode = new AudioWorkletNode(audioContext, 'pcm16-processor');

        const micAnalyser = audioContext.createAnalyser();
        micAnalyser.fftSize = 2048;
        micAnalyser.smoothingTimeConstant = 0.85;
        const micDataArray = new Uint8Array(micAnalyser.frequencyBinCount);

        workletNode.port.onmessage = (e) => {
            if (!isConnected || !isRecording || !ws || ws.readyState !== WebSocket.OPEN) return;
            const base64 = arrayBufferToBase64(e.data);
            audioChunksSent++;
            ws.send(JSON.stringify({ type: 'audio_chunk', data: base64 }));
        };

        source.connect(workletNode);
        source.connect(micAnalyser);
        workletNode.connect(audioContext.destination);

        micAnalyserNode = micAnalyser;
        micAnalyserDataArray = micDataArray;
        analyserNode = micAnalyser;
        analyserDataArray = micDataArray;
        startVolumeAnimation('record');
        console.log('[Audio] Capture started (24kHz PCM16)');
    } catch (err) {
        console.error('Audio capture error', err);
        addMessage('system', 'Microphone access denied or not available');
    }
}

function stopAudioCapture() {
    stopRecordAnimation();
    micAnalyserNode = null; micAnalyserDataArray = null;
    if (workletNode) { try { workletNode.disconnect(); } catch (e) {} workletNode = null; }
    if (audioContext) { try { audioContext.close(); } catch (e) {} audioContext = null; }
    if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
    resetVolumeCircle();
}

// ===== Audio Playback (24kHz PCM16) =====
function handleAudioDelta(base64Data) {
    if (!base64Data) return;
    if (!playbackContext) {
        playbackContext = new AudioContext({ sampleRate: 24000 });
        analyserNode = playbackContext.createAnalyser();
        analyserNode.fftSize = 2048;
        analyserNode.smoothingTimeConstant = 0.85;
        analyserDataArray = new Uint8Array(analyserNode.frequencyBinCount);
        analyserNode.connect(playbackContext.destination);
        nextPlaybackTime = 0;
    }
    const arrayBuffer = base64ToArrayBuffer(base64Data);
    const int16 = new Int16Array(arrayBuffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
    const buffer = playbackContext.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);
    const source = playbackContext.createBufferSource();
    source.buffer = buffer;
    source.connect(analyserNode);
    const now = playbackContext.currentTime;
    if (nextPlaybackTime < now) nextPlaybackTime = now;
    source.start(nextPlaybackTime);
    nextPlaybackTime += buffer.duration;
    if (!playChunkAnimationFrameId) startVolumeAnimation('play-chunk');
}

function stopAudioPlayback() {
    stopPlayChunkAnimation();
    if (playbackContext) { try { playbackContext.close(); } catch (e) {} playbackContext = null; }
    playbackBufferQueue = [];
    nextPlaybackTime = 0;
    if (isRecording && micAnalyserNode) {
        analyserNode = micAnalyserNode; analyserDataArray = micAnalyserDataArray;
        startVolumeAnimation('record');
    } else {
        analyserNode = null; analyserDataArray = null; resetVolumeCircle();
    }
}

// ===== Volume Animation =====
function startVolumeAnimation(animationType) {
    if (animationType === 'record') stopPlayChunkAnimation();
    else { stopPlayChunkAnimation(); stopRecordAnimation(); }
    const isRecord = animationType === 'record';
    const calculateVolume = () => {
        if (analyserNode && analyserDataArray) {
            analyserNode.getByteFrequencyData(analyserDataArray);
            const volume = Array.from(analyserDataArray).reduce((acc, v) => acc + v, 0) / analyserDataArray.length;
            updateVolumeCircle(volume, animationType);
        }
        if (isRecord) {
            if (!isRecording) { recordAnimationFrameId = null; resetVolumeCircle(); return; }
            recordAnimationFrameId = requestAnimationFrame(calculateVolume);
        } else {
            if (!isSpeaking && (!playbackContext || playbackContext.currentTime >= nextPlaybackTime + 0.3)) {
                playChunkAnimationFrameId = null;
                if (isRecording && micAnalyserNode) {
                    analyserNode = micAnalyserNode; analyserDataArray = micAnalyserDataArray;
                    startVolumeAnimation('record');
                } else { analyserNode = null; analyserDataArray = null; resetVolumeCircle(); }
                return;
            }
            playChunkAnimationFrameId = requestAnimationFrame(calculateVolume);
        }
    };
    calculateVolume();
}

function stopRecordAnimation() {
    if (recordAnimationFrameId) { cancelAnimationFrame(recordAnimationFrameId); recordAnimationFrameId = null; }
}

function stopPlayChunkAnimation() {
    if (playChunkAnimationFrameId) { cancelAnimationFrame(playChunkAnimationFrameId); playChunkAnimationFrameId = null; }
}

function stopVolumeAnimation() { stopRecordAnimation(); stopPlayChunkAnimation(); }

function updateVolumeCircle(volume, animationType) {
    const circle = document.getElementById('volumeCircle');
    if (!circle) return;
    const size = 160 + volume;
    circle.style.backgroundColor = animationType === 'record' ? 'lightgray' : 'lightblue';
    circle.style.width = size + 'px';
    circle.style.height = size + 'px';
}

function resetVolumeCircle() {
    const circle = document.getElementById('volumeCircle');
    if (!circle) return;
    circle.style.width = ''; circle.style.height = ''; circle.style.backgroundColor = '';
}

// ===== WebSocket Video Playback =====
function setupWebSocketVideoPlayback(isPhotoAvatar) {
    cleanupWebSocketVideo();
    const container = document.getElementById('avatarVideo');
    if (container) container.innerHTML = '';
    const videoElement = document.createElement('video');
    videoElement.id = 'ws-video'; videoElement.autoplay = true; videoElement.playsInline = true;
    if (isPhotoAvatar) videoElement.style.borderRadius = '10%';
    videoElement.style.width = 'auto';
    videoElement.style.height = isDeveloperMode ? 'auto' : '';
    videoElement.style.objectFit = 'cover'; videoElement.style.display = 'block';
    videoElement.addEventListener('canplay', () => { videoElement.play().catch(e => console.error('Play error:', e)); });
    const FMP4_MIME_CODEC = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
    if (!MediaSource.isTypeSupported(FMP4_MIME_CODEC)) {
        addMessage('system', 'WebSocket video playback not supported. Please use WebRTC mode.'); return;
    }
    mediaSource = new MediaSource();
    videoElement.src = URL.createObjectURL(mediaSource);
    mediaSource.addEventListener('sourceopen', () => {
        try {
            if (mediaSource.readyState === 'open') {
                sourceBuffer = mediaSource.addSourceBuffer(FMP4_MIME_CODEC);
                sourceBuffer.addEventListener('updateend', () => { processVideoChunkQueue(); });
            }
        } catch (e) { console.error('Error creating SourceBuffer:', e); }
    });
    if (container) container.appendChild(videoElement);
    else pendingWsVideoElement = videoElement;
}

let videoChunkCount = 0;

function handleVideoChunk(base64Data) {
    if (!base64Data) return;
    try {
        const binaryString = atob(base64Data);
        const arrayBuffer = new ArrayBuffer(binaryString.length);
        const bytes = new Uint8Array(arrayBuffer);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        videoChunksQueue.push(arrayBuffer);
        processVideoChunkQueue();
    } catch (e) { console.error('Error handling video chunk:', e); }
}

function processVideoChunkQueue() {
    if (!sourceBuffer || sourceBuffer.updating || !mediaSource || mediaSource.readyState !== 'open') return;
    const next = videoChunksQueue.shift();
    if (!next) return;
    try { sourceBuffer.appendBuffer(next); } catch (e) { console.error('Error appending video chunk:', e); }
}

function cleanupWebSocketVideo() {
    videoChunksQueue = [];
    if (sourceBuffer && mediaSource) {
        try { if (mediaSource.readyState === 'open' && !sourceBuffer.updating) mediaSource.endOfStream(); }
        catch (e) { console.error('Error ending MediaSource stream:', e); }
    }
    sourceBuffer = null; mediaSource = null; pendingWsVideoElement = null;
}

// ===== WebRTC for Avatar =====
function preparePeerConnection(iceServers) {
    const iceConfig = iceServers.map(s => ({ urls: s.urls, username: s.username || undefined, credential: s.credential || undefined }));
    const pc = new RTCPeerConnection({ iceServers: iceConfig });
    let iceGatheringDone = false;
    pc.ontrack = (event) => {
        const container = document.getElementById('avatarVideo');
        const mediaPlayer = document.createElement(event.track.kind);
        mediaPlayer.id = event.track.kind; mediaPlayer.srcObject = event.streams[0]; mediaPlayer.autoplay = false;
        mediaPlayer.addEventListener('loadeddata', () => { mediaPlayer.play(); });
        if (container) container.appendChild(mediaPlayer);
        if (event.track.kind === 'video') {
            avatarVideoElement = mediaPlayer;
            mediaPlayer.style.width = '0.1%'; mediaPlayer.style.height = '0.1%';
            mediaPlayer.onplaying = () => { setTimeout(() => { mediaPlayer.style.width = ''; mediaPlayer.style.height = ''; }, 0); };
        }
    };
    pc.onicegatheringstatechange = () => {};
    pc.onicecandidate = (event) => {
        if (!event.candidate && !iceGatheringDone) {
            iceGatheringDone = true;
            peerConnectionQueue.push(pc);
            if (peerConnectionQueue.length > 1) { const old = peerConnectionQueue.shift(); try { old.close(); } catch (e) {} }
        }
    };
    pc.addTransceiver('video', { direction: 'sendrecv' });
    pc.addTransceiver('audio', { direction: 'sendrecv' });
    pc.addEventListener('datachannel', (event) => {
        const dc = event.channel;
        dc.onmessage = (e) => { console.log('[' + new Date().toISOString() + '] WebRTC event: ' + e.data); };
        dc.onclose = () => { console.log('Data channel closed'); };
    });
    pc.createDataChannel('eventChannel');
    pc.createOffer().then(offer => pc.setLocalDescription(offer)).then(() => {
        setTimeout(() => {
            if (!iceGatheringDone) {
                iceGatheringDone = true;
                peerConnectionQueue.push(pc);
                if (peerConnectionQueue.length > 1) { const old = peerConnectionQueue.shift(); try { old.close(); } catch (e) {} }
            }
        }, 10000);
    }).catch(err => { console.error('preparePeerConnection offer error', err); });
}

function setupWebRTC(iceServers) {
    if (peerConnection) cleanupWebRTC();
    cachedIceServers = iceServers;
    const container = document.getElementById('avatarVideo');
    if (container) container.innerHTML = '';

    if (peerConnectionQueue.length > 0) {
        peerConnection = peerConnectionQueue.shift();
        const sdpJson = JSON.stringify(peerConnection.localDescription);
        const sdpBase64 = btoa(sdpJson);
        ws.send(JSON.stringify({ type: 'avatar_sdp_offer', clientSdp: sdpBase64 }));
        preparePeerConnection(iceServers);
        return;
    }

    const iceConfig = iceServers.map(s => ({ urls: s.urls, username: s.username || undefined, credential: s.credential || undefined }));
    peerConnection = new RTCPeerConnection({ iceServers: iceConfig });
    peerConnection.ontrack = (event) => {
        const mediaPlayer = document.createElement(event.track.kind);
        mediaPlayer.id = event.track.kind; mediaPlayer.srcObject = event.streams[0]; mediaPlayer.autoplay = false;
        mediaPlayer.addEventListener('loadeddata', () => { mediaPlayer.play(); });
        if (container) container.appendChild(mediaPlayer);
        if (event.track.kind === 'video') {
            avatarVideoElement = mediaPlayer;
            mediaPlayer.style.width = '0.1%'; mediaPlayer.style.height = '0.1%';
            mediaPlayer.onplaying = () => { setTimeout(() => { mediaPlayer.style.width = ''; mediaPlayer.style.height = ''; }, 0); };
        }
    };
    peerConnection.onicegatheringstatechange = () => {};
    let iceGatheringDone = false;
    peerConnection.onicecandidate = (event) => {
        if (!event.candidate && !iceGatheringDone) {
            iceGatheringDone = true;
            const sdpJson = JSON.stringify(peerConnection.localDescription);
            ws.send(JSON.stringify({ type: 'avatar_sdp_offer', clientSdp: btoa(sdpJson) }));
        }
    };
    peerConnection.addTransceiver('video', { direction: 'sendrecv' });
    peerConnection.addTransceiver('audio', { direction: 'sendrecv' });
    peerConnection.addEventListener('datachannel', (event) => {
        const dc = event.channel;
        dc.onmessage = (e) => { console.log('[' + new Date().toISOString() + '] WebRTC event: ' + e.data); };
        dc.onclose = () => { console.log('Data channel closed'); };
    });
    peerConnection.createDataChannel('eventChannel');
    peerConnection.createOffer().then(offer => peerConnection.setLocalDescription(offer)).then(() => {
        setTimeout(() => {
            if (!iceGatheringDone) {
                iceGatheringDone = true;
                const sdpJson = JSON.stringify(peerConnection.localDescription);
                ws.send(JSON.stringify({ type: 'avatar_sdp_offer', clientSdp: btoa(sdpJson) }));
            }
        }, 10000);
    }).catch(err => { console.error('WebRTC offer error', err); addMessage('system', 'WebRTC setup failed'); });
    preparePeerConnection(iceServers);
}

function handleAvatarSdpAnswer(serverSdpBase64) {
    if (!peerConnection || !serverSdpBase64) return;
    try {
        const serverSdpObj = JSON.parse(atob(serverSdpBase64));
        peerConnection.setRemoteDescription(new RTCSessionDescription(serverSdpObj))
            .then(() => { console.log('[WebRTC] Remote SDP set'); })
            .catch(err => { console.error('SDP answer error', err); });
    } catch (e) { console.error('Failed to parse server SDP', e); }
}

function cleanupWebRTC() {
    if (peerConnection) { try { peerConnection.close(); } catch (e) {} peerConnection = null; }
    if (avatarVideoElement) { avatarVideoElement.srcObject = null; avatarVideoElement = null; }
    const container = document.getElementById('avatarVideo');
    if (container) container.innerHTML = '';
}

// ===== Mic Toggle =====
function toggleMicrophone() {
    if (!isConnected) return;
    isRecording = !isRecording;
    updateMicUI();
    if (isRecording && micAnalyserNode) {
        analyserNode = micAnalyserNode; analyserDataArray = micAnalyserDataArray;
        startVolumeAnimation('record');
    } else if (!isRecording) { stopRecordAnimation(); resetVolumeCircle(); }
}

// ===== Send Text =====
function sendTextMessage() {
    const input = document.getElementById('textInput');
    const text = input.value.trim();
    if (!text || !isConnected || !ws) return;
    addMessage('user', text);
    ws.send(JSON.stringify({ type: 'send_text', text }));
    input.value = '';
}

// ===== Speech Events =====
function onSpeechStarted(itemId) {
    isSpeaking = true;
    stopAudioPlayback();
    if (itemId) {
        const contentDiv = addMessage('user', '...');
        if (contentDiv) contentDiv.closest('.message').setAttribute('data-item-id', itemId);
    }
}

function onSpeechStopped() { pendingAssistantText = ''; isSpeaking = false; }

// ===== Utilities =====
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
}