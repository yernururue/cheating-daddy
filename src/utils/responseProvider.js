// Which service answers transcriptions in BYOK mode. Gemini Live always handles transcription;
// 'gemini' means its own spoken answer is used instead of a separate text provider.
const RESPONSE_PROVIDERS = ['gemini', 'groq', 'openrouter'];

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

module.exports = {
    RESPONSE_PROVIDERS,
    resolveResponseProvider,
};
