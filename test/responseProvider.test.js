const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveResponseProvider, RESPONSE_PROVIDERS } = require('../src/utils/responseProvider');

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
