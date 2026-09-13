const test = require('node:test');
const assert = require('node:assert/strict');
const { chat } = require('../services/ai/AIService');

test('safe diagnostics preserve provider status/code and never echo credentials or raw errors', async t => {
  const originalKey = process.env.GROQ_API_KEY;
  const originalModel = process.env.GROQ_MODEL;
  t.after(() => {
    if (originalKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.GROQ_MODEL; else process.env.GROQ_MODEL = originalModel;
  });
  process.env.GROQ_API_KEY = 'synthetic-sensitive-key';
  process.env.GROQ_MODEL = 'test-model';
  const logs = [];
  t.mock.method(console, 'warn', (...args) => logs.push(args));
  t.mock.method(global, 'fetch', async () => ({ status: 400, ok: false, json: async () => ({
    error: { code: 'model_decommissioned', type: 'invalid_request_error',
      message: 'Authorization: Bearer synthetic-sensitive-key private customer data' }
  }) }));
  await assert.rejects(chat('Xin chào'), { code: 'GROQ_PROVIDER_ERROR', status: 502 });
  assert.equal(logs[0][1].httpStatus, 400);
  assert.equal(logs[0][1].model, 'test-model');
  assert.equal(logs[0][1].errorCode, 'model_decommissioned');
  assert.match(logs[0][1].message, /retired/);
  process.env.GROQ_MODEL = 'synthetic-sensitive-key';
  global.fetch.mock.mockImplementation(async () => ({ status: 401, ok: false, json: async () => ({
    error: { code: 'synthetic-sensitive-key', type: 'Authorization: Bearer synthetic-sensitive-key', message: 'private' }
  }) }));
  await assert.rejects(chat('Xin chào'), { code: 'GROQ_PROVIDER_ERROR' });
  assert.equal(logs[1][1].model, '[redacted]');
  assert.ok(!JSON.stringify(logs).includes('synthetic-sensitive-key'));
  assert.ok(!JSON.stringify(logs).includes('Authorization'));
  assert.ok(!JSON.stringify(logs).includes('private'));
});

test('HTTP general chat returns Groq success and explicit configuration errors, not 404', async t => {
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use('/api/ai', require('../api/ai'));
  const key = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL;
  t.after(() => {
    if (key === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = key;
    if (model === undefined) delete process.env.GROQ_MODEL; else process.env.GROQ_MODEL = model;
  });
  const realFetch = global.fetch;
  t.mock.method(global, 'fetch', async (url, options) => {
    if (url.startsWith('http://127.0.0.1:')) return realFetch(url, options);
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'Chào bạn!' }, finish_reason: 'stop' }] }) };
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  async function send(message) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/ai/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message })
    });
    return { status: response.status, body: await response.json() };
  }
  try {
    delete process.env.GROQ_API_KEY;
    const missing = await send('Xin chào');
    assert.equal(missing.status, 503);
    assert.equal(missing.body.code, 'GROQ_NOT_CONFIGURED');
    process.env.GROQ_API_KEY = 'synthetic-test-key';
    delete process.env.GROQ_MODEL;
    assert.equal((await send('Xin chào')).body.code, 'GROQ_MODEL_MISSING');
    process.env.GROQ_MODEL = 'test-model';
    assert.deepEqual(await send('Xin chào'), { status: 200, body: { reply: 'Chào bạn!', type: 'general', products: [] } });
    assert.equal((await send(' ')).status, 400);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('Groq validation, contract, configuration, timeout and sanitized failures', async t => {
  const oldKey = process.env.GROQ_API_KEY;
  const oldModel = process.env.GROQ_MODEL;
  t.after(() => {
    if (oldKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.GROQ_MODEL; else process.env.GROQ_MODEL = oldModel;
  });
  let requests = 0;
  t.mock.method(global, 'fetch', async (url, options) => {
    requests++;
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'test-model');
    assert.equal(body.messages[1].content, 'Xin chào');
    assert.equal(body.messages[0].role, 'system');
    assert.equal(body.tools, undefined);
    return { ok: true, json: async () => ({ choices: [{ message: { content: ' Chào bạn! ' }, finish_reason: 'stop' }] }) };
  });
  for (const message of [null, undefined, {}, 1, '', '  ', 'x'.repeat(2001)]) {
    await assert.rejects(chat(message), { code: 'INVALID_MESSAGE' });
  }
  delete process.env.GROQ_API_KEY;
  await assert.rejects(chat('Xin chào'), { code: 'GROQ_NOT_CONFIGURED' });
  assert.equal((await chat('Hotline?')).type, 'faq');
  assert.equal(requests, 0);
  process.env.GROQ_API_KEY = 'test-only-key';
  process.env.GROQ_MODEL = 'test-model';
  assert.deepEqual(await chat(' Xin chào '), { reply: 'Chào bạn!', type: 'general', products: [] });
  delete process.env.GROQ_MODEL;
  await assert.rejects(chat('Xin chào'), { code: 'GROQ_MODEL_MISSING' });
  process.env.GROQ_MODEL = 'test-model';
  global.fetch.mock.mockImplementation(async (url, options) => {
    assert.equal(JSON.parse(options.body).model, 'test-model');
    return { ok: false };
  });
  await assert.rejects(chat('Xin chào'), { code: 'GROQ_PROVIDER_ERROR' });
  global.fetch.mock.mockImplementation(async () => ({ ok: false, status: 429 }));
  await assert.rejects(chat('Xin chào'), { code: 'GROQ_RATE_LIMIT' });
  for (const data of [null, {}, { choices: [{ message: { content: '' } }] }, { choices: [{ message: { content: 'partial' }, finish_reason: 'length' }] }]) {
    global.fetch.mock.mockImplementation(async () => ({ ok: true, json: async () => data }));
    await assert.rejects(chat('Xin chào'), { code: 'GROQ_INVALID_RESPONSE' });
  }
  global.fetch.mock.mockImplementation(async () => ({ ok: true, json: async () => { throw new SyntaxError('private'); } }));
  await assert.rejects(chat('Xin chào'), { code: 'GROQ_INVALID_RESPONSE' });
  global.fetch.mock.mockImplementation(async () => { throw new Error('test-only-key private details'); });
  await assert.rejects(chat('Xin chào'), error => error.code === 'GROQ_NETWORK_ERROR' && !error.message.includes('private') && !error.message.includes('test-only-key'));
  t.mock.method(global, 'setTimeout', callback => { queueMicrotask(callback); return 0; });
  global.fetch.mock.mockImplementation(async (url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }));
  await assert.rejects(chat('Xin chào'), { code: 'GROQ_TIMEOUT' });
});
