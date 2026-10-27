const { test } = require('node:test');
const assert = require('node:assert/strict');
const { toMenuBarText, paginate, clampPage } = require('../src/utils/menuBarText');

const byLength = s => s.length;

test('toMenuBarText joins lines into one line and drops markdown markers', () => {
    assert.equal(toMenuBarText('# Answer\n\n**B** is correct.\n\n- one\n- two'), 'Answer · B is correct. · one · two');
    assert.equal(toMenuBarText('See [the docs](https://example.com) and `O(n log n)`'), 'See the docs and O(n log n)');
    assert.equal(toMenuBarText('*italic*, _also_, ~~gone~~ and __bold__'), 'italic, also, gone and bold');
    assert.equal(toMenuBarText('> quoted\n* star item\n+ plus item'), 'quoted · star item · plus item');
});

test('toMenuBarText keeps numbered answers and identifiers intact', () => {
    assert.equal(toMenuBarText('1) b  2) d'), '1) b 2) d');
    assert.equal(toMenuBarText('1. first\n2. second'), '1. first · 2. second');
    assert.equal(toMenuBarText('use snake_case_name and 2*3*4'), 'use snake_case_name and 2*3*4');
});

test('toMenuBarText keeps code but drops the fences', () => {
    assert.equal(toMenuBarText('Use:\n```js\nconst a = 1;\nreturn a;\n```'), 'Use: · const a = 1; · return a;');
});

test('toMenuBarText returns an empty string for empty or non-string input', () => {
    assert.equal(toMenuBarText(''), '');
    assert.equal(toMenuBarText('  \n\n '), '');
    assert.equal(toMenuBarText(null), '');
    assert.equal(toMenuBarText(undefined), '');
});

test('paginate keeps text that fits on one page', () => {
    assert.deepEqual(paginate('short answer', 20, byLength), ['short answer']);
});

test('paginate wraps at word boundaries', () => {
    assert.deepEqual(paginate('aaa bbb ccc ddd', 7, byLength), ['aaa bbb', 'ccc ddd']);
    assert.deepEqual(paginate('aaa bbb ccc', 8, byLength), ['aaa bbb', 'ccc']);
});

test('paginate hard-splits words longer than a page', () => {
    assert.deepEqual(paginate('abcdefghij xy', 4, byLength), ['abcd', 'efgh', 'ij', 'xy']);
});

test('paginate returns no pages for empty text', () => {
    assert.deepEqual(paginate('', 10, byLength), []);
    assert.deepEqual(paginate('   ', 10, byLength), []);
});

test('paginate defaults to measuring by character count', () => {
    assert.deepEqual(paginate('aa bb', 2), ['aa', 'bb']);
});

test('clampPage keeps the page index inside the page list', () => {
    assert.equal(clampPage(0, 0), 0);
    assert.equal(clampPage(5, 0), 0);
    assert.equal(clampPage(-1, 3), 0);
    assert.equal(clampPage(1, 3), 1);
    assert.equal(clampPage(7, 3), 2);
    assert.equal(clampPage(NaN, 3), 0);
});
