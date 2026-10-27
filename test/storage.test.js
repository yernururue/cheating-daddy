const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// storage.js resolves its directory from os.homedir(); point HOME at a temp dir before loading it.
const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-storage-test-'));
const originalHome = process.env.HOME;
const originalUserProfile = process.env.USERPROFILE;
let storage;

before(() => {
    process.env.HOME = tmpHome;
    process.env.USERPROFILE = tmpHome;
    storage = require('../src/storage');
    storage.initializeStorage();
});

after(() => {
    process.env.HOME = originalHome;
    process.env.USERPROFILE = originalUserProfile;
    fs.rmSync(tmpHome, { recursive: true, force: true });
});

test('config dir lives under the temp HOME', () => {
    assert.ok(storage.getConfigDir().startsWith(tmpHome));
});

test('config has OpenRouter defaults and a response provider', () => {
    const config = storage.getConfig();
    assert.equal(config.responseProvider, 'groq');
    assert.equal(typeof config.openrouterModel, 'string');
    assert.ok(config.openrouterModel.includes('/'));
    assert.equal(typeof config.openrouterImageModel, 'string');
    assert.ok(config.openrouterImageModel.includes('/'));
});

test('OpenRouter API key round-trips without touching other credentials', () => {
    storage.setApiKey('gemini-key');
    storage.setGroqApiKey('groq-key');
    assert.equal(storage.getOpenRouterApiKey(), '');

    storage.setOpenRouterApiKey('sk-or-test');
    assert.equal(storage.getOpenRouterApiKey(), 'sk-or-test');
    assert.equal(storage.getApiKey(), 'gemini-key');
    assert.equal(storage.getGroqApiKey(), 'groq-key');
});

test('existing configs without new keys still get OpenRouter defaults', () => {
    const configPath = path.join(storage.getConfigDir(), 'config.json');
    const legacy = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    delete legacy.responseProvider;
    delete legacy.openrouterModel;
    delete legacy.openrouterImageModel;
    fs.writeFileSync(configPath, JSON.stringify(legacy));

    const config = storage.getConfig();
    assert.equal(config.responseProvider, 'groq');
    assert.ok(config.openrouterModel);
});

test('response provider and model choices persist', () => {
    storage.updateConfig('responseProvider', 'openrouter');
    storage.updateConfig('openrouterModel', 'anthropic/claude-sonnet-5.5');
    const config = storage.getConfig();
    assert.equal(config.responseProvider, 'openrouter');
    assert.equal(config.openrouterModel, 'anthropic/claude-sonnet-5.5');
});
