// OpenRouter (https://openrouter.ai) client helpers. Kept free of Electron imports so it can be unit tested.

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';
const OPENROUTER_CHAT_URL = `${OPENROUTER_API_BASE}/chat/completions`;
const OPENROUTER_MODELS_URL = `${OPENROUTER_API_BASE}/models`;
const OPENROUTER_MAX_TOKENS = 16384;

// Lowest-effort first; used when the user disables thinking.
const LOW_EFFORT_ORDER = ['none', 'minimal', 'low'];

function stripThinkingTags(text) {
    const trimmedStart = text.trimStart();
    if ('<think>'.startsWith(trimmedStart)) {
        return '';
    }

    return text.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();
}

// ── Models ──

function isFreePricing(pricing) {
    if (!pricing) return false;
    return Number(pricing.prompt) === 0 && Number(pricing.completion) === 0;
}

function normalizeModels(apiJson) {
    const data = Array.isArray(apiJson?.data) ? apiJson.data : [];

    return data
        .filter(model => model && typeof model.id === 'string' && model.id)
        .filter(model => !model.id.endsWith(':batch'))
        .filter(model => {
            const outputs = model.architecture?.output_modalities;
            return !Array.isArray(outputs) || outputs.includes('text');
        })
        .map(model => ({
            id: model.id,
            name: model.name || model.id,
            contextLength: model.context_length || model.top_provider?.context_length || null,
            supportsImages: (model.architecture?.input_modalities || []).includes('image'),
            isFree: model.id.endsWith(':free') || isFreePricing(model.pricing),
            reasoning: model.reasoning
                ? {
                      mandatory: model.reasoning.mandatory === true,
                      supportedEfforts: Array.isArray(model.reasoning.supported_efforts) ? model.reasoning.supported_efforts : null,
                  }
                : null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

function filterModels(models, query, { imageOnly = false } = {}) {
    const needle = (query || '').trim().toLowerCase();

    return models.filter(model => {
        if (imageOnly && !model.supportsImages) return false;
        if (!needle) return true;
        return model.id.toLowerCase().includes(needle) || model.name.toLowerCase().includes(needle);
    });
}

async function fetchModels({ fetchImpl = fetch } = {}) {
    const response = await fetchImpl(OPENROUTER_MODELS_URL, { method: 'GET' });
    if (!response.ok) {
        throw new Error(`OpenRouter models request failed: ${response.status}`);
    }
    return normalizeModels(await response.json());
}

// ── Requests ──

function buildHeaders(apiKey) {
    return {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // App attribution, see https://openrouter.ai/docs/app-attribution
        'HTTP-Referer': 'https://github.com/sohzm/cheating-daddy',
        'X-Title': 'Cheating Daddy',
    };
}

// Reasoning is never shown as answer text. When thinking is disabled, pick the lowest effort the model accepts:
// 'none' is rejected by models with mandatory reasoning, so they get 'minimal'/'low' instead.
function buildReasoningOptions(modelInfo, disableThinking) {
    const options = { exclude: true };
    const efforts = modelInfo?.reasoning?.supportedEfforts;

    if (!disableThinking || !Array.isArray(efforts)) {
        return options;
    }

    const allowed = modelInfo.reasoning.mandatory ? efforts.filter(effort => effort !== 'none') : efforts;
    const effort = LOW_EFFORT_ORDER.find(candidate => allowed.includes(candidate));
    return effort ? { effort, exclude: true } : options;
}

function buildChatBody({ model, messages, disableThinking = false, modelInfo = null }) {
    if (!model || !model.trim()) {
        throw new Error('OpenRouter model is not set');
    }

    return {
        model: model.trim(),
        messages,
        stream: true,
        temperature: 0.7,
        max_tokens: OPENROUTER_MAX_TOKENS,
        reasoning: buildReasoningOptions(modelInfo, disableThinking),
    };
}

// ── Streaming ──

// Server-sent events parser that tolerates events split across network chunks.
function createSseParser(onEvent) {
    let buffer = '';

    function handleLine(rawLine) {
        const line = rawLine.replace(/\r$/, '');
        if (!line.startsWith('data:')) return; // comments (": OPENROUTER PROCESSING"), blank lines, other fields

        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') return;

        try {
            onEvent(JSON.parse(data));
        } catch {
            // ignore malformed payloads
        }
    }

    return {
        push(chunk) {
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop();
            lines.forEach(handleLine);
        },
        end() {
            if (buffer) handleLine(buffer);
            buffer = '';
        },
    };
}

function formatApiError(status, bodyText) {
    let detail = bodyText;
    try {
        detail = JSON.parse(bodyText)?.error?.message || bodyText;
    } catch {
        // body is not JSON
    }
    const error = new Error(`OpenRouter error ${status}${detail ? `: ${detail}` : ''}`);
    error.status = status;
    return error;
}

// Streams a chat completion. onText receives the full cleaned text so far on every change.
async function streamChatCompletion({ apiKey, body, fetchImpl = fetch, onText = () => {}, onEvent = () => {} }) {
    if (!apiKey || !apiKey.trim()) {
        throw new Error('OpenRouter API key is not set');
    }

    const response = await fetchImpl(OPENROUTER_CHAT_URL, {
        method: 'POST',
        headers: buildHeaders(apiKey.trim()),
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw formatApiError(response.status, await response.text());
    }

    let fullText = '';
    let lastSent = '';
    let finishReason = null;
    let streamError = null;

    const parser = createSseParser(event => {
        onEvent(event);
        if (event.error) {
            streamError = streamError || new Error(`OpenRouter error: ${event.error.message || 'stream failed'}`);
            return;
        }

        const choice = event.choices?.[0];
        finishReason = choice?.finish_reason || finishReason;
        const token = choice?.delta?.content || '';
        if (!token) return;

        fullText += token;
        const displayText = stripThinkingTags(fullText);
        if (displayText && displayText !== lastSent) {
            lastSent = displayText;
            onText(displayText);
        }
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));
        if (streamError) {
            await reader.cancel().catch(() => {});
            break;
        }
    }
    parser.end();

    if (streamError) throw streamError;

    return { text: stripThinkingTags(fullText), finishReason };
}

module.exports = {
    OPENROUTER_API_BASE,
    OPENROUTER_CHAT_URL,
    OPENROUTER_MODELS_URL,
    OPENROUTER_MAX_TOKENS,
    stripThinkingTags,
    normalizeModels,
    filterModels,
    fetchModels,
    buildHeaders,
    buildReasoningOptions,
    buildChatBody,
    createSseParser,
    streamChatCompletion,
};
