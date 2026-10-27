const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ANSWER_STYLES, applyAnswerStyle, getScreenshotPrompt, getSystemPrompt } = require('../src/utils/prompts');

test('exposes the answer styles', () => {
    assert.deepEqual(ANSWER_STYLES, ['detailed', 'short']);
});

test('applyAnswerStyle leaves the prompt unchanged for detailed answers', () => {
    assert.equal(applyAnswerStyle('BASE', 'detailed'), 'BASE');
    assert.equal(applyAnswerStyle('BASE', undefined), 'BASE');
    assert.equal(applyAnswerStyle('BASE', 'bogus'), 'BASE');
});

test('applyAnswerStyle appends a short-answer override after the base prompt', () => {
    const prompt = applyAnswerStyle('BASE', 'short');
    assert.ok(prompt.startsWith('BASE'));
    assert.match(prompt, /1\) /);
    assert.match(prompt, /no explanation/i);
});

test('short style works on a real profile prompt', () => {
    const base = getSystemPrompt('exam', '', false);
    const prompt = applyAnswerStyle(base, 'short');
    assert.ok(prompt.length > base.length);
    assert.ok(prompt.endsWith(prompt.slice(base.length)));
});

test('getScreenshotPrompt: detailed asks for the full solution', () => {
    const prompt = getScreenshotPrompt('detailed');
    assert.match(prompt, /entire code/i);
});

test('getScreenshotPrompt: short asks for numbered answers only', () => {
    const prompt = getScreenshotPrompt('short');
    assert.match(prompt, /1\) /);
    assert.doesNotMatch(prompt, /entire code/i);
    assert.equal(getScreenshotPrompt(undefined), getScreenshotPrompt('detailed'));
});
