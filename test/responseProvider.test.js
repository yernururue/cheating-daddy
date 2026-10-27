const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveResponseProvider, resolveImageProvider, RESPONSE_PROVIDERS, IMAGE_PROVIDERS } = require('../src/utils/responseProvider');

test('exposes the supported response providers', () => {
    assert.deepEqual(RESPONSE_PROVIDERS, ['gemini', 'groq', 'openrouter']);
});

test('resolveResponseProvider: openrouter selected with key', () => {
    assert.equal(resolveResponseProvider({ responseProvider: 'openrouter' }, { openrouterApiKey: 'sk-or-1' }), 'openrouter');
});

test('resolveResponseProvider: openrouter selected without key falls back to Gemini Live', () => {
    assert.equal(resolveResponseProvider({ responseProvider: 'openrouter' }, { openrouterApiKey: '   ', groqApiKey: 'gsk' }), null);
});

test('resolveResponseProvider: groq selected with key', () => {
    assert.equal(resolveResponseProvider({ responseProvider: 'groq' }, { groqApiKey: 'gsk', openrouterApiKey: 'sk-or-1' }), 'groq');
});

test('resolveResponseProvider: gemini selected ignores configured keys', () => {
    assert.equal(resolveResponseProvider({ responseProvider: 'gemini' }, { groqApiKey: 'gsk', openrouterApiKey: 'sk-or-1' }), null);
});

test('resolveResponseProvider: missing setting keeps legacy behavior (Groq when key present)', () => {
    assert.equal(resolveResponseProvider({}, { groqApiKey: 'gsk' }), 'groq');
    assert.equal(resolveResponseProvider({}, {}), null);
    assert.equal(resolveResponseProvider(undefined, undefined), null);
});

test('resolveResponseProvider: unknown value is treated as legacy default', () => {
    assert.equal(resolveResponseProvider({ responseProvider: 'bogus' }, { groqApiKey: 'gsk' }), 'groq');
});

// ── Screenshot (image) provider ──

const ALL_KEYS = { groqApiKey: 'gsk', openrouterApiKey: 'sk-or-1' };

test('exposes the supported image providers', () => {
    assert.deepEqual(IMAGE_PROVIDERS, ['auto', 'gemini', 'groq', 'openrouter']);
});

test('resolveImageProvider: auto follows the response provider', () => {
    assert.equal(resolveImageProvider({ imageProvider: 'auto', responseProvider: 'openrouter' }, ALL_KEYS), 'openrouter');
    assert.equal(resolveImageProvider({ imageProvider: 'auto', responseProvider: 'groq' }, ALL_KEYS), 'groq');
    assert.equal(resolveImageProvider({ imageProvider: 'auto', responseProvider: 'gemini' }, ALL_KEYS), null);
});

test('resolveImageProvider: missing setting behaves like auto', () => {
    assert.equal(resolveImageProvider({ responseProvider: 'openrouter' }, ALL_KEYS), 'openrouter');
    assert.equal(resolveImageProvider(undefined, undefined), null);
});

test('resolveImageProvider: OpenRouter for screenshots while Gemini Live answers speech', () => {
    assert.equal(resolveImageProvider({ imageProvider: 'openrouter', responseProvider: 'gemini' }, { openrouterApiKey: 'sk-or-1' }), 'openrouter');
});

test('resolveImageProvider: OpenRouter for screenshots while Groq answers speech', () => {
    const config = { imageProvider: 'openrouter', responseProvider: 'groq' };
    assert.equal(resolveImageProvider(config, ALL_KEYS), 'openrouter');
    assert.equal(resolveResponseProvider(config, ALL_KEYS), 'groq');
});

test('resolveImageProvider: explicit provider without key falls back to the response provider', () => {
    assert.equal(resolveImageProvider({ imageProvider: 'openrouter', responseProvider: 'groq' }, { groqApiKey: 'gsk' }), 'groq');
    assert.equal(resolveImageProvider({ imageProvider: 'groq', responseProvider: 'gemini' }, { openrouterApiKey: 'sk-or-1' }), null);
});

test('resolveImageProvider: gemini forces Gemini HTTP even when keys exist', () => {
    assert.equal(resolveImageProvider({ imageProvider: 'gemini', responseProvider: 'openrouter' }, ALL_KEYS), null);
});
