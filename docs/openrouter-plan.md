# OpenRouter response provider — plan

## Goal

In BYOK mode, let the user pick which service generates answers: **Gemini Live** (built-in), **Groq**, or **OpenRouter**.
For OpenRouter, the user enters an API key and picks a text model and an image model from the live OpenRouter catalog
(searchable, with a custom-ID fallback).

Gemini Live stays the transcription layer (OpenRouter has no realtime audio API), exactly like Groq today.

## Design

### Config / credentials (`src/storage.js`)

- `config.responseProvider`: `'groq' | 'openrouter' | 'gemini'`, default `'groq'` (preserves current behavior: Groq if a key
  is set, otherwise Gemini Live).
- `config.openrouterModel`, `config.openrouterImageModel` (defaults: a capable multimodal model).
- `credentials.openrouterApiKey` + `getOpenRouterApiKey` / `setOpenRouterApiKey`, wired through `index.js` IPC and
  `renderer.js` storage wrapper.
- No `CONFIG_VERSION` bump (that wipes user data); new keys come from defaults.

### Pure modules (unit-tested, no Electron)

`src/utils/responseProvider.js`

- `resolveResponseProvider(config, { groqApiKey, openrouterApiKey })` → `'groq' | 'openrouter' | null`
  (`null` = let Gemini Live answer). Selected provider without a key → `null`.

`src/utils/openrouter.js`

- `normalizeModels(apiJson)` → `[{ id, name, contextLength, supportsImages, isFree, reasoning }]` sorted by name.
- `filterModels(models, query, { imageOnly })` — case-insensitive match on id and name.
- `buildReasoningOptions(modelInfo, disableThinking)` — `{ effort: 'none' }` only when the model allows it
  (not `mandatory`, `supported_efforts` contains `none`); always `exclude: true` so reasoning never shows up as answer text.
- `buildChatBody({ model, messages, disableThinking, modelInfo })`.
- `createSseParser(onEvent)` — buffered SSE parser: handles events split across network chunks, `: OPENROUTER PROCESSING`
  comments and `[DONE]`.
- `streamChatCompletion({ apiKey, body, fetchImpl, onText })` → `{ text, finishReason }`; throws on HTTP errors and on
  mid-stream `error` events.
- `fetchModels({ fetchImpl })` — GET `https://openrouter.ai/api/v1/models`.

### Main process (`src/utils/gemini.js`)

- Replace `hasGroqKey()` checks with `getActiveResponseProvider()`; share one conversation history for whichever provider
  is active.
- `sendToOpenRouter(transcription)` / `sendImageToOpenRouter(base64, prompt)` using `streamChatCompletion`, streaming to
  `new-response` / `update-response`, saving turns/screen analysis like Groq.
- IPC `openrouter:list-models` → fetched catalog (cached in main for 10 min, also used for reasoning options).

### UI (`src/components/views/MainView.js`)

"AI responses" section gets a provider `<select>`. OpenRouter panel: API key, text model picker, image model picker
(image-capable models only), each with a search box, a refresh link, "(free)" tags, and "Custom model ID…".
Disable-thinking checkbox applies to both Groq and OpenRouter.

## Tests (written first, `node --test`)

- `test/responseProvider.test.js` — provider resolution incl. backward compat and missing keys.
- `test/openrouter.test.js` — normalization, filtering, reasoning options, request body, SSE parsing across chunk
  boundaries, streaming via fake `fetch` (success, HTTP error, mid-stream error), model fetch.
- `test/storage.test.js` — OpenRouter key round-trip and config defaults with `HOME` pointed at a temp dir.

## Follow-up: separate screenshot provider

`config.imageProvider`: `'auto' | 'gemini' | 'groq' | 'openrouter'` (default `'auto'` = same as `responseProvider`).
Resolved by `resolveImageProvider()` in `src/utils/responseProvider.js`; an explicit provider without a key falls back to
`auto`. This lets screenshots go to a paid OpenRouter vision model while speech answers stay on Gemini Live or Groq.
The UI shows a "Screenshot analysis" select and only the key/model fields the chosen combination needs.
