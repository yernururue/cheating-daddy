# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Electron app (plain JavaScript, no bundler, no TypeScript) that captures screen + audio and streams them to an AI provider for real-time answers in a transparent always-on-top overlay. See `AGENTS.md` for aspirational migration goals (TypeScript/React/shadcn) — none of that exists yet; follow the existing Lit + CommonJS style.

## Commands

```bash
npm install
npm start                 # electron-forge start (dev app)
npm run make              # build installers (dmg/squirrel/deb/rpm/AppImage)
npm test                  # node:test suite in test/ (no Electron required)
node --test test/openrouter.test.js   # single test file
node --test --test-name-pattern="resolveResponseProvider" test/   # single test by name
npx prettier --write .    # formatting (4 spaces, width 150, single quotes); no linter
```

## Architecture

**Process split.** `src/index.js` is the Electron main process: it initializes storage, creates the window (`src/utils/window.js` — window flags, global shortcuts), and registers IPC handlers. The renderer is `src/index.html`, which loads `src/utils/renderer.js` (a classic script with `nodeIntegration`, so it uses `require('electron').ipcRenderer` directly) and the Lit UI starting at `src/components/app/CheatingDaddyApp.js`. `renderer.js` exposes everything the UI needs on `window.cheatingDaddy` (`storage.*` IPC wrappers, `initializeGemini`, `startCapture`, …). Lit is vendored in `src/assets/lit-core-2.7.4.min.js`; components import it by relative path.

**Provider modes** (`preferences.providerMode`):

- `byok` (default): Gemini Live (`@google/genai` `live.connect`) receives audio and does transcription with speaker diarization. If a _response provider_ (Groq / OpenRouter) is configured with a key, each finished transcription is sent to that provider via OpenAI-compatible streaming chat completions and Gemini Live's own spoken answer is ignored; otherwise Gemini Live's output transcription is shown as the answer. Screenshots go to the response provider's image model, or to Gemini HTTP (`getAvailableModel()` rotates flash/flash-lite by daily count).
- `local`: `src/utils/localai.js` + `native-ai-runtime.js` download and run llama.cpp and whisper.cpp servers locally (VAD → whisper → llama).
- `cloud`: `src/utils/cloud.js` websocket backend. The UI path is intentionally disabled; stored `cloud` is migrated to `byok`.

`src/utils/gemini.js` is the hub despite its name: it owns `currentProviderMode`, all session/audio/image/text IPC handlers (`send-audio-content`, `send-image-content`, `send-text-message`, `close-session`, …), routes each by mode, keeps conversation history, and pushes results to the renderer with `sendToRenderer('new-response' | 'update-response' | 'update-status', …)`. `localai.js` lazily requires `gemini.js` (circular dependency) — keep that lazy.

**Session overlay.** When the renderer switches to the `assistant` view it sends `view-changed`; `window.js` then shrinks the same window to a small click-through box in a screen corner (`src/utils/overlayLayout.js`; preferences `compactOverlay`, `compactOverlayOpacity`, last position in `compactOverlayBounds`) and restores the full window when the session ends. Hovering the box sends `overlay-hover`, which turns click-through off until the cursor leaves, so answers can be scrolled with the mouse and `[end]` clicked. Compact `AssistantView` hides its input and navigation; the rest is global shortcuts (Ask Next Step = analyze screen, End Session, Toggle Click-through, previous/next/scroll response).

**Answer style.** Preference `answerStyle` (`detailed` | `short`) is applied in `src/utils/prompts.js`: `applyAnswerStyle()` appends a bare-answers override to the system prompt (Gemini Live, Groq/OpenRouter, local), and `getScreenshotPrompt()` picks the screenshot prompt in the `send-image-content` handler.

**Screenshots.** Taken on demand in the main process via `desktopCapturer` (`src/utils/screenCapture.js`, IPC `capture-screen`), from the display the app window is on. Don't switch back to frames from a `getDisplayMedia` stream: on macOS 15+ (ScreenCaptureKit) that stream ignores `setContentProtection` and the overlay ends up in its own screenshots, while `desktopCapturer` leaves it out.

**Audio.** macOS system audio comes from the bundled `src/assets/SystemAudioDump` binary spawned by the main process (24 kHz stereo PCM → mono). Windows/Linux capture in the renderer and send base64 PCM over IPC.

**Storage** (`src/storage.js`): JSON files under the OS config dir (`~/Library/Application Support/cheating-daddy-config` on macOS): `config.json` (models, `responseProvider`), `credentials.json` (API keys), `preferences.json` (UI prefs, provider mode), `limits.json` (daily usage), `history/<sessionId>.json`. Values are merged over `DEFAULT_*` objects on read. Bumping `CONFIG_VERSION` **wipes the whole config dir** on next start — avoid it; add new keys with defaults instead. Every storage function the renderer needs requires three edits: `storage.js` export, an `ipcMain.handle('storage:…')` in `index.js`, and a wrapper in `renderer.js`'s `storage` object.

**Prompts.** `src/utils/prompts.js` builds the system prompt per profile (interview, sales, meeting, …); the same prompt is reused for whichever response provider is active.

## Tests

Tests use Node's built-in `node:test` + `node:assert` (no dependencies) and live in `test/`. Only pure modules that don't `require('electron')` can be tested directly (e.g. `src/utils/openrouter.js`, `src/utils/responseProvider.js`, `src/storage.js` with `HOME` pointed at a temp dir). Keep provider logic (request building, SSE parsing, model-list normalization) in such pure modules and inject `fetch` so it can be tested without network.
