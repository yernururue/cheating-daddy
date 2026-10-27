const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    OPENROUTER_CHAT_URL,
    OPENROUTER_MODELS_URL,
    normalizeModels,
    filterModels,
    buildReasoningOptions,
    buildChatBody,
    buildHeaders,
    createSseParser,
    streamChatCompletion,
    fetchModels,
} = require('../src/utils/openrouter');

const RAW_MODELS = {
    data: [
        {
            id: 'openai/gpt-5.6-luna',
            name: 'OpenAI: GPT-5.6 Luna',
            context_length: 400000,
            architecture: { input_modalities: ['file', 'image', 'text'], output_modalities: ['text'] },
            pricing: { prompt: '0.000001', completion: '0.000004' },
            reasoning: { mandatory: false, supported_efforts: ['high', 'low', 'none'] },
        },
        {
            id: 'meta/llama-text:free',
            name: 'Meta: Llama Text (free)',
            context_length: 128000,
            architecture: { input_modalities: ['text'], output_modalities: ['text'] },
            pricing: { prompt: '0', completion: '0' },
        },
        {
            id: 'openai/gpt-5.6-luna:batch',
            name: 'OpenAI: GPT-5.6 Luna (batch)',
            architecture: { input_modalities: ['text'], output_modalities: ['text'] },
            pricing: { prompt: '0', completion: '0' },
        },
        {
            id: 'google/image-gen',
            name: 'Google: Image Generator',
            architecture: { input_modalities: ['text'], output_modalities: ['image'] },
            pricing: { prompt: '0.1', completion: '0.1' },
        },
        {
            id: 'anthropic/claude-sonnet-5.5',
            name: 'Anthropic: Claude Sonnet 5.5',
            context_length: 1000000,
            architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] },
            pricing: { prompt: '0.000003', completion: '0.000015' },
            reasoning: { mandatory: true, supported_efforts: ['high', 'low'] },
        },
    ],
};

// ── normalizeModels ──

test('normalizeModels keeps chat models, drops batch and non-text-output models, sorts by name', () => {
    const models = normalizeModels(RAW_MODELS);
    assert.deepEqual(
        models.map(m => m.id),
        ['anthropic/claude-sonnet-5.5', 'meta/llama-text:free', 'openai/gpt-5.6-luna']
    );
});

test('normalizeModels extracts image support, free flag, context and reasoning info', () => {
    const [claude, llama, gpt] = normalizeModels(RAW_MODELS);
    assert.equal(claude.supportsImages, true);
    assert.equal(claude.isFree, false);
    assert.equal(claude.contextLength, 1000000);
    assert.deepEqual(claude.reasoning, { mandatory: true, supportedEfforts: ['high', 'low'] });

    assert.equal(llama.supportsImages, false);
    assert.equal(llama.isFree, true);
    assert.equal(llama.reasoning, null);

    assert.equal(gpt.name, 'OpenAI: GPT-5.6 Luna');
});

test('normalizeModels tolerates malformed input', () => {
    assert.deepEqual(normalizeModels(null), []);
    assert.deepEqual(normalizeModels({}), []);
    assert.deepEqual(normalizeModels({ data: [null, { name: 'no id' }] }), []);
});

// ── filterModels ──

test('filterModels matches id or name case-insensitively', () => {
    const models = normalizeModels(RAW_MODELS);
    assert.deepEqual(
        filterModels(models, 'CLAUDE').map(m => m.id),
        ['anthropic/claude-sonnet-5.5']
    );
    assert.deepEqual(
        filterModels(models, 'meta/').map(m => m.id),
        ['meta/llama-text:free']
    );
});

test('filterModels with imageOnly returns only vision models', () => {
    const models = normalizeModels(RAW_MODELS);
    assert.deepEqual(
        filterModels(models, '', { imageOnly: true }).map(m => m.id),
        ['anthropic/claude-sonnet-5.5', 'openai/gpt-5.6-luna']
    );
});

test('filterModels with empty query returns everything', () => {
    const models = normalizeModels(RAW_MODELS);
    assert.equal(filterModels(models, '   ').length, models.length);
});

// ── buildReasoningOptions ──

test('buildReasoningOptions always hides reasoning from the answer', () => {
    assert.deepEqual(buildReasoningOptions(null, false), { exclude: true });
});

test('buildReasoningOptions disables reasoning when the model allows effort none', () => {
    const info = { reasoning: { mandatory: false, supportedEfforts: ['high', 'low', 'none'] } };
    assert.deepEqual(buildReasoningOptions(info, true), { effort: 'none', exclude: true });
});

test('buildReasoningOptions falls back to the lowest effort for mandatory-reasoning models', () => {
    assert.deepEqual(buildReasoningOptions({ reasoning: { mandatory: true, supportedEfforts: ['high', 'medium', 'low', 'minimal'] } }, true), {
        effort: 'minimal',
        exclude: true,
    });
    assert.deepEqual(buildReasoningOptions({ reasoning: { mandatory: true, supportedEfforts: ['high', 'low'] } }, true), {
        effort: 'low',
        exclude: true,
    });
    // mandatory models must never get effort "none" even if listed
    assert.deepEqual(buildReasoningOptions({ reasoning: { mandatory: true, supportedEfforts: ['none', 'low'] } }, true), {
        effort: 'low',
        exclude: true,
    });
});

test('buildReasoningOptions sends no effort when it is unknown or thinking is enabled', () => {
    assert.deepEqual(buildReasoningOptions({ reasoning: null }, true), { exclude: true });
    assert.deepEqual(buildReasoningOptions({ reasoning: { mandatory: false, supportedEfforts: ['none'] } }, false), { exclude: true });
});

// ── buildChatBody / headers ──

test('buildChatBody builds a streaming OpenAI-compatible body', () => {
    const messages = [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hi' },
    ];
    const body = buildChatBody({
        model: 'openai/gpt-5.6-luna',
        messages,
        disableThinking: true,
        modelInfo: { reasoning: { mandatory: false, supportedEfforts: ['none'] } },
    });
    assert.deepEqual(body, {
        model: 'openai/gpt-5.6-luna',
        messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 16384,
        reasoning: { effort: 'none', exclude: true },
    });
});

test('buildChatBody rejects a missing model', () => {
    assert.throws(() => buildChatBody({ model: '  ', messages: [] }), /model/i);
});

test('buildHeaders sends bearer auth and app attribution', () => {
    const headers = buildHeaders('sk-or-123');
    assert.equal(headers.Authorization, 'Bearer sk-or-123');
    assert.equal(headers['Content-Type'], 'application/json');
    assert.equal(headers['X-Title'], 'Cheating Daddy');
    assert.ok(headers['HTTP-Referer']);
});

// ── createSseParser ──

test('createSseParser handles events split across chunks, comments and [DONE]', () => {
    const events = [];
    const parser = createSseParser(e => events.push(e));
    parser.push(': OPENROUTER PROCESSING\n\n');
    parser.push('data: {"choices":[{"delta":{"content":"Hel');
    parser.push('lo"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"},"finish_reason":"stop"}]}\n');
    parser.push('\ndata: [DONE]\n\n');
    parser.end();
    assert.deepEqual(events, [
        { choices: [{ delta: { content: 'Hello' } }] },
        { choices: [{ delta: { content: ' world' }, finish_reason: 'stop' }] },
    ]);
});

test('createSseParser handles CRLF line endings and flushes a trailing event on end()', () => {
    const events = [];
    const parser = createSseParser(e => events.push(e));
    parser.push('data: {"a":1}\r\n\r\ndata: {"b":2}');
    parser.end();
    assert.deepEqual(events, [{ a: 1 }, { b: 2 }]);
});

test('createSseParser skips unparseable data lines', () => {
    const events = [];
    const parser = createSseParser(e => events.push(e));
    parser.push('data: not-json\n\ndata: {"ok":true}\n\n');
    parser.end();
    assert.deepEqual(events, [{ ok: true }]);
});

// ── streamChatCompletion ──

function sseResponse(chunks, { status = 200 } = {}) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        start(controller) {
            for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
            controller.close();
        },
    });
    return new Response(stream, { status, headers: { 'Content-Type': 'text/event-stream' } });
}

test('streamChatCompletion posts to OpenRouter and streams accumulated text', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
        calls.push({ url, init });
        return sseResponse([
            'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
            'data: {"choices":[{"delta":{"reasoning":"thinking..."}}]}\n\n',
            'data: {"choices":[{"delta":{"content":"lo"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
        ]);
    };
    const updates = [];
    const body = { model: 'x/y', messages: [], stream: true };
    const result = await streamChatCompletion({ apiKey: 'sk-or-1', body, fetchImpl, onText: t => updates.push(t) });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, OPENROUTER_CHAT_URL);
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer sk-or-1');
    assert.deepEqual(JSON.parse(calls[0].init.body), body);
    assert.deepEqual(updates, ['Hel', 'Hello']);
    assert.deepEqual(result, { text: 'Hello', finishReason: 'stop' });
});

test('streamChatCompletion strips <think> blocks from streamed text', async () => {
    const fetchImpl = async () => sseResponse(['data: {"choices":[{"delta":{"content":"<think>hmm</think>Answer"}}]}\n\n']);
    const updates = [];
    const result = await streamChatCompletion({ apiKey: 'k', body: {}, fetchImpl, onText: t => updates.push(t) });
    assert.equal(result.text, 'Answer');
    assert.deepEqual(updates, ['Answer']);
});

test('streamChatCompletion throws a readable error on HTTP failure', async () => {
    const fetchImpl = async () => new Response(JSON.stringify({ error: { message: 'No auth credentials found', code: 401 } }), { status: 401 });
    await assert.rejects(
        streamChatCompletion({ apiKey: 'bad', body: {}, fetchImpl }),
        err => err.status === 401 && /401/.test(err.message) && /No auth credentials found/.test(err.message)
    );
});

test('streamChatCompletion throws on a mid-stream error event', async () => {
    const fetchImpl = async () =>
        sseResponse([
            'data: {"choices":[{"delta":{"content":"partial"}}]}\n\n',
            'data: {"error":{"message":"Provider disconnected","code":502},"choices":[{"delta":{"content":""},"finish_reason":"error"}]}\n\n',
        ]);
    await assert.rejects(streamChatCompletion({ apiKey: 'k', body: {}, fetchImpl }), /Provider disconnected/);
});

test('streamChatCompletion requires an API key', async () => {
    await assert.rejects(streamChatCompletion({ apiKey: '', body: {}, fetchImpl: async () => sseResponse([]) }), /API key/i);
});

// ── fetchModels ──

test('fetchModels GETs the catalog and returns normalized models', async () => {
    let calledUrl = null;
    const fetchImpl = async url => {
        calledUrl = url;
        return new Response(JSON.stringify(RAW_MODELS), { status: 200 });
    };
    const models = await fetchModels({ fetchImpl });
    assert.equal(calledUrl, OPENROUTER_MODELS_URL);
    assert.equal(models.length, 3);
});

test('fetchModels throws on HTTP failure', async () => {
    const fetchImpl = async () => new Response('down', { status: 503 });
    await assert.rejects(fetchModels({ fetchImpl }), /503/);
});
