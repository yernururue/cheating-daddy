// Which service answers transcriptions in BYOK mode. Gemini Live always handles transcription;
// 'gemini' means its own spoken answer is used instead of a separate text provider.
const RESPONSE_PROVIDERS = ['gemini', 'groq', 'openrouter'];

// Which service analyzes screenshots. 'auto' follows the response provider; 'gemini' means Gemini HTTP.
const IMAGE_PROVIDERS = ['auto', 'gemini', 'groq', 'openrouter'];

function hasKey(key) {
    return typeof key === 'string' && key.trim() !== '';
}

// Returns 'groq' | 'openrouter' | null (null = let Gemini Live answer).
// A missing or unknown setting keeps the legacy behavior: Groq whenever a Groq key is set.
function resolveResponseProvider(config, keys) {
    const provider = config?.responseProvider;
    const { groqApiKey, openrouterApiKey } = keys || {};

    if (provider === 'gemini') return null;
    if (provider === 'openrouter') return hasKey(openrouterApiKey) ? 'openrouter' : null;
    return hasKey(groqApiKey) ? 'groq' : null;
}

// Returns 'groq' | 'openrouter' | null (null = Gemini HTTP). Lets screenshots use a different provider than speech,
// e.g. OpenRouter for images while Gemini Live answers questions. An explicit provider without a key falls back to auto.
function resolveImageProvider(config, keys) {
    const provider = config?.imageProvider;
    const { groqApiKey, openrouterApiKey } = keys || {};

    if (provider === 'gemini') return null;
    if (provider === 'openrouter' && hasKey(openrouterApiKey)) return 'openrouter';
    if (provider === 'groq' && hasKey(groqApiKey)) return 'groq';
    return resolveResponseProvider(config, keys);
}

module.exports = {
    RESPONSE_PROVIDERS,
    IMAGE_PROVIDERS,
    resolveResponseProvider,
    resolveImageProvider,
};
