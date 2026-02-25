"""
E2E test suite for all Voice Live backends.

Part 1: WebSocket-level — connect, send audio, verify responses.
Part 2: Playwright browser — open UI, mock mic, verify transcripts.

Usage:
  python tests/e2e_all_backends.py                          # all backends, both test types
  python tests/e2e_all_backends.py --ws-only                # WebSocket tests only
  python tests/e2e_all_backends.py --browser-only           # Playwright tests only
  python tests/e2e_all_backends.py --url <url>              # single backend URL
  python tests/e2e_all_backends.py --mode agent             # test agent mode (default: model)

Requires: WAV files in AUDIO_DIR (or set E2E_AUDIO_DIR env var).
"""

import asyncio
import base64
import json
import os
import struct
import sys
import time
import wave
from dataclasses import dataclass, field

# ---------------------------------------------------------------------------
# Config — override via env vars: E2E_PYTHON_URL, E2E_CSHARP_URL, etc.
# ---------------------------------------------------------------------------

BACKENDS = {
    "python": os.environ.get("E2E_PYTHON_URL", "https://ca-web-6gid4mrqdtsmw.salmonglacier-1408708f.eastus2.azurecontainerapps.io"),
    "csharp": os.environ.get("E2E_CSHARP_URL", "https://ca-web-qg4nkh5hmc7ym.politesea-37a9566c.eastus2.azurecontainerapps.io"),
    "javascript": os.environ.get("E2E_JAVASCRIPT_URL", "https://ca-web-4moqmg55acn7i.mangobay-f47f6964.eastus2.azurecontainerapps.io"),
    "java": os.environ.get("E2E_JAVA_URL", "https://ca-web-yr2tlf7e33wzk.delightfulbush-e74d6a7d.eastus2.azurecontainerapps.io"),
}

# Agent mode settings — override via env vars for your deployment
AGENT_NAME = os.environ.get("E2E_AGENT_NAME", "voicelive-assistant")
AGENT_PROJECT = os.environ.get("E2E_AGENT_PROJECT", "voicelive-project")

AUDIO_DIR = os.environ.get(
    "E2E_AUDIO_DIR",
    os.path.join(os.path.dirname(__file__), "audio"),
)
TARGET_SAMPLE_RATE = 24000
CHUNK_SIZE = 7200  # bytes per chunk (150ms at 24kHz 16-bit mono)
SESSION_TIMEOUT = 30  # seconds to wait for responses


def _generate_synthetic_wav_chunks() -> list[str]:
    """Generate synthetic 440Hz sine wave PCM16 chunks as a fallback when no WAV files are available."""
    import math
    duration_s = 5  # 5 seconds of audio
    total_samples = TARGET_SAMPLE_RATE * duration_s
    pcm = b""
    for i in range(total_samples):
        sample = int(16000 * math.sin(2 * math.pi * 440 * i / TARGET_SAMPLE_RATE))
        pcm += struct.pack("<h", max(-32768, min(32767, sample)))
    chunks = []
    for i in range(0, len(pcm), CHUNK_SIZE):
        chunks.append(base64.b64encode(pcm[i : i + CHUNK_SIZE]).decode())
    return chunks


@dataclass
class TestResult:
    backend: str
    test_type: str
    mode: str
    passed: bool = False
    duration: float = 0.0
    details: str = ""
    audio_received: int = 0
    transcripts: list = field(default_factory=list)
    errors: list = field(default_factory=list)


# ---------------------------------------------------------------------------
# Audio helpers
# ---------------------------------------------------------------------------

def resample_pcm16(data: bytes, src_rate: int, dst_rate: int) -> bytes:
    if src_rate == dst_rate:
        return data
    samples = struct.unpack(f"<{len(data)//2}h", data)
    ratio = src_rate / dst_rate
    n_out = int(len(samples) / ratio)
    out = []
    for i in range(n_out):
        src_pos = i * ratio
        idx = int(src_pos)
        frac = src_pos - idx
        val = samples[idx] * (1 - frac) + (samples[idx + 1] * frac if idx + 1 < len(samples) else 0)
        out.append(int(max(-32768, min(32767, val))))
    return struct.pack(f"<{len(out)}h", *out)


def load_wav_chunks(audio_dir: str) -> list[str]:
    """Load first WAV file from dir, resample to 24kHz PCM16, return as base64 chunks.
    Falls back to synthetic sine wave if the audio directory doesn't exist."""
    if not os.path.isdir(audio_dir):
        print(f"    ⚠ Audio dir not found ({audio_dir}), using synthetic 440Hz tone")
        return _generate_synthetic_wav_chunks()

    wav_files = sorted(
        [f for f in os.listdir(audio_dir) if f.endswith(".wav")]
    )
    if not wav_files:
        print(f"    ⚠ No .wav files in {audio_dir}, using synthetic 440Hz tone")
        return _generate_synthetic_wav_chunks()

    wav_path = os.path.join(audio_dir, wav_files[0])
    with wave.open(wav_path, "rb") as wf:
        src_rate = wf.getframerate()
        raw = wf.readframes(wf.getnframes())

    pcm = resample_pcm16(raw, src_rate, TARGET_SAMPLE_RATE)
    chunks = []
    for i in range(0, len(pcm), CHUNK_SIZE):
        chunk = pcm[i : i + CHUNK_SIZE]
        chunks.append(base64.b64encode(chunk).decode())
    return chunks


# ---------------------------------------------------------------------------
# Part 1: WebSocket test
# ---------------------------------------------------------------------------

async def ws_test(base_url: str, backend_name: str, mode: str = "model") -> TestResult:
    """Connect via WebSocket, send audio, verify responses."""
    import websockets

    result = TestResult(backend=backend_name, test_type="websocket", mode=mode)
    ws_url = base_url.replace("https://", "wss://").replace("http://", "ws://")
    ws_url = f"{ws_url}/ws/e2e-test-{int(time.time())}"

    start = time.time()
    try:
        import ssl
        ssl_ctx = ssl.create_default_context()
        chunks = load_wav_chunks(AUDIO_DIR)

        async with websockets.connect(
            ws_url,
            ssl=ssl_ctx,
            close_timeout=10,
            open_timeout=20,
            additional_headers={"Origin": base_url},
        ) as ws:
            # Send start_session
            start_msg = {
                "type": "start_session",
                "mode": mode,
                "model": "gpt-realtime",
                "voice": "en-US-Ava:DragonHDLatestNeural",
                "voice_type": "azure-standard",
                "vad_type": "azure_semantic",
                "transcribe_model": "gpt-4o-transcribe",
                "noise_reduction": True,
                "echo_cancellation": True,
                "proactive_greeting": True,
                "greeting_type": "llm",
                "interim_response": False,
                "temperature": 0.7,
            }
            # Agent mode requires agent_name and project
            if mode == "agent":
                start_msg["agent_name"] = AGENT_NAME
                start_msg["project"] = AGENT_PROJECT
            await ws.send(json.dumps(start_msg))

            # Wait for session_started
            session_started = False
            deadline = time.time() + SESSION_TIMEOUT
            while time.time() < deadline:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=5)
                    msg = json.loads(raw)
                    if msg.get("type") == "session_started":
                        session_started = True
                        break
                    elif msg.get("type") == "error":
                        result.errors.append(msg.get("message", "unknown error"))
                        break
                except asyncio.TimeoutError:
                    continue

            if not session_started:
                result.details = f"session_started not received. Errors: {result.errors}"
                result.duration = time.time() - start
                return result

            # Wait for greeting audio to flow, then send audio chunks
            await asyncio.sleep(3)

            for chunk in chunks:
                await ws.send(json.dumps({"type": "audio_chunk", "data": chunk}))
                await asyncio.sleep(0.15)  # ~realtime pacing

            # Collect responses
            collect_deadline = time.time() + SESSION_TIMEOUT
            while time.time() < collect_deadline:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=3)
                    msg = json.loads(raw)
                    msg_type = msg.get("type")

                    if msg_type == "audio_data":
                        result.audio_received += 1
                    elif msg_type == "transcript":
                        result.transcripts.append(
                            f"[{msg.get('role', '?')}] {msg.get('text', '')[:80]}"
                        )
                    elif msg_type == "error":
                        result.errors.append(msg.get("message", ""))
                except asyncio.TimeoutError:
                    if result.audio_received > 0 or result.transcripts:
                        break

            # Stop — wait briefly for server to acknowledge before closing
            await ws.send(json.dumps({"type": "stop_session"}))
            try:
                await asyncio.wait_for(ws.recv(), timeout=3)
            except (asyncio.TimeoutError, Exception):
                pass

        result.passed = (result.audio_received > 0 or len(result.transcripts) > 0) and len(result.errors) == 0
        result.details = (
            f"audio_chunks={result.audio_received}, "
            f"transcripts={len(result.transcripts)}, "
            f"errors={len(result.errors)}"
        )

    except websockets.exceptions.ConnectionClosedError:
        # Some backends (Java/Spring) close without a clean close frame
        result.passed = result.audio_received > 0 or len(result.transcripts) > 0
        result.details = (
            f"audio_chunks={result.audio_received}, "
            f"transcripts={len(result.transcripts)}, "
            f"errors={len(result.errors)} (unclean close)"
        )
    except Exception as e:
        # Still pass if we got meaningful data before the exception
        if (result.audio_received > 0 or result.transcripts) and "close frame" in str(e):
            result.passed = True
            result.details = (
                f"audio_chunks={result.audio_received}, "
                f"transcripts={len(result.transcripts)}, "
                f"errors={len(result.errors)} (unclean close)"
            )
        else:
            result.errors.append(str(e))
            result.details = f"Exception: {e}"

    result.duration = time.time() - start
    return result


# ---------------------------------------------------------------------------
# Part 2: Playwright browser test
# ---------------------------------------------------------------------------

async def browser_test(base_url: str, backend_name: str, mode: str = "model") -> TestResult:
    """Open UI in Playwright, verify page loads and session can start."""
    from playwright.async_api import async_playwright

    result = TestResult(backend=backend_name, test_type="browser", mode=mode)
    start = time.time()

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(permissions=["microphone"])
            page = await context.new_page()

            # Inject mic mock before page loads
            await page.add_init_script("""
                navigator.mediaDevices.getUserMedia = async function(constraints) {
                    if (constraints.audio) {
                        const ctx = new AudioContext({ sampleRate: 24000 });
                        const osc = ctx.createOscillator();
                        const dest = ctx.createMediaStreamDestination();
                        osc.frequency.value = 440;
                        osc.connect(dest);
                        osc.start();
                        return dest.stream;
                    }
                    throw new Error('Video not supported in test');
                };
                window.__E2E_MIC_MOCKED = true;
            """)

            # Navigate
            response = await page.goto(base_url, wait_until="networkidle", timeout=30000)
            status = response.status if response else 0

            title = await page.title()

            # Look for the start button or voice orb
            await page.wait_for_timeout(2000)

            # Select mode if agent — open settings, click agent toggle, close settings
            if mode == "agent":
                settings_btn = page.locator("button[aria-label='Settings'], button[title='Settings']")
                if await settings_btn.count() > 0:
                    await settings_btn.first.click()
                    await page.wait_for_timeout(500)
                    # Click the "Agent" segmented button in the settings panel
                    agent_btn = page.locator("button").filter(has_text="Agent")
                    if await agent_btn.count() > 0:
                        await agent_btn.first.click()
                        await page.wait_for_timeout(300)
                    # Close settings panel
                    close_btn = page.locator("button[aria-label='Close settings']")
                    if await close_btn.count() > 0:
                        await close_btn.first.click()
                        await page.wait_for_timeout(500)

            start_btn = page.locator("button").filter(has_text="Start")
            orb = page.locator("[class*='orb'], [class*='Orb'], [class*='voice']")

            has_start = await start_btn.count() > 0
            has_orb = await orb.count() > 0

            # Click start if available — this will trigger mic access (mocked)
            session_started = False
            if has_start:
                await start_btn.first.click()
                # Wait for session to establish
                await page.wait_for_timeout(5000)

                # Check for any transcript or audio visualization
                transcripts = page.locator("[class*='transcript'], [class*='message'], [class*='bubble']")
                transcript_count = await transcripts.count()

                # Check if orb is now visible (session active)
                orb_after = await page.locator("[class*='orb'], [class*='Orb']").count()
                session_started = transcript_count > 0 or orb_after > 0

            # Screenshot
            screenshot_path = os.path.join(
                os.path.dirname(os.path.abspath(__file__)),
                f"screenshot_{backend_name}.png",
            )
            await page.screenshot(path=screenshot_path, full_page=True)

            result.passed = status == 200 and (has_start or has_orb) and session_started
            result.details = (
                f"HTTP {status}, title='{title}', "
                f"start_btn={has_start}, orb={has_orb}, "
                f"session_active={session_started}, "
                f"screenshot={screenshot_path}"
            )

            await browser.close()

    except Exception as e:
        result.errors.append(str(e))
        result.details = f"Exception: {e}"

    result.duration = time.time() - start
    return result


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

def print_result(r: TestResult):
    status = "✅ PASS" if r.passed else "❌ FAIL"
    print(f"\n  {status}  {r.backend} ({r.test_type}, {r.mode}) — {r.duration:.1f}s")
    print(f"    {r.details}")
    if r.transcripts:
        for t in r.transcripts[:5]:
            print(f"    📝 {t}")
    if r.errors:
        for e in r.errors[:3]:
            print(f"    ⚠️  {e[:120]}")


async def main():
    args = sys.argv[1:]
    ws_only = "--ws-only" in args
    browser_only = "--browser-only" in args
    mode = "model"
    if "--mode" in args:
        idx = args.index("--mode")
        if idx + 1 < len(args):
            mode = args[idx + 1]

    if "--url" in args:
        idx = args.index("--url")
        url = args[idx + 1]
        backends = {"custom": url}
    else:
        backends = BACKENDS

    print(f"\n{'='*60}")
    print(f"  Voice Live E2E Test Suite")
    print(f"  Backends: {', '.join(backends.keys())}")
    print(f"  Mode: {mode}")
    print(f"  Tests: {'WS' if ws_only else 'Browser' if browser_only else 'WS + Browser'}")
    print(f"{'='*60}")

    results: list[TestResult] = []

    if not browser_only:
        print(f"\n--- WebSocket Tests ({mode} mode) ---")
        for name, url in backends.items():
            print(f"  Testing {name}...", end="", flush=True)
            r = await ws_test(url, name, mode)
            results.append(r)
            print_result(r)

    if not ws_only:
        print(f"\n--- Playwright Browser Tests ---")
        for name, url in backends.items():
            print(f"  Testing {name}...", end="", flush=True)
            r = await browser_test(url, name, mode)
            results.append(r)
            print_result(r)

    passed = sum(1 for r in results if r.passed)
    total = len(results)
    print(f"\n{'='*60}")
    print(f"  Results: {passed}/{total} passed")
    print(f"{'='*60}\n")

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
