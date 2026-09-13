const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createLimiter } = require('../utils/AuthRateLimit');

function attempt(limiter, { baseUrl = '/api/customer', ip = '127.0.0.1', username = 'account', status = 200, success = false } = {}) {
  const res = new EventEmitter();
  Object.assign(res, { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  let called = false;
  limiter({ baseUrl, ip, body: { username } }, res, () => {
    called = true;
    res.status(status).json({ success });
  });
  return { res, called };
}

test('login failure windows isolate identity/IP/endpoint, clear on success, ignore 500, expire', () => {
  for (const baseUrl of ['/api/admin', '/api/customer']) {
    let time = 0;
    const limiter = createLimiter({ windowMs: 300000, identity: true, now: () => time });
    for (let i = 0; i < 10; i++) assert.equal(attempt(limiter, { baseUrl, status: 500 }).called, true);
    for (let i = 0; i < 4; i++) assert.equal(attempt(limiter, { baseUrl }).called, true);
    assert.equal(attempt(limiter, { baseUrl, success: true }).called, true);
    for (let i = 0; i < 5; i++) assert.equal(attempt(limiter, { baseUrl }).called, true);
    const blocked = attempt(limiter, { baseUrl, username: ' ACCOUNT ' });
    assert.equal(blocked.called, false); assert.equal(blocked.res.statusCode, 429);
    assert.equal(blocked.res.headers['Retry-After'], '300');
    assert.equal(attempt(limiter, { baseUrl, username: 'other' }).called, true);
    assert.equal(attempt(limiter, { baseUrl, ip: '127.0.0.2' }).called, true);
    time = 300001;
    assert.equal(attempt(limiter, { baseUrl }).called, true);
  }
});

test('forgot counts every request per IP; reset counts failures only; capacity fails closed and cleans up', () => {
  const forgot = createLimiter({ windowMs: 900000, allRequests: true });
  for (let i = 0; i < 5; i++) assert.equal(attempt(forgot, { username: 'email-' + i, success: true }).called, true);
  assert.equal(attempt(forgot).res.statusCode, 429);
  const reset = createLimiter({ windowMs: 900000 });
  for (let i = 0; i < 4; i++) assert.equal(attempt(reset, { status: 400 }).called, true);
  assert.equal(attempt(reset, { success: true }).called, true);
  for (let i = 0; i < 5; i++) attempt(reset, { status: 400 });
  assert.equal(attempt(reset).res.headers['Retry-After'], '900');
  let time = 0;
  const bounded = createLimiter({ windowMs: 10, identity: true, maxEntries: 1, now: () => time });
  attempt(bounded);
  assert.equal(attempt(bounded, { username: 'other' }).res.statusCode, 429);
  time = 11;
  assert.equal(attempt(bounded, { username: 'other' }).called, true);
});

test('in-flight reservations remain charged after close until outcome or window expiry', () => {
  const limiter = createLimiter({ windowMs: 10000, limit: 1 });
  const held = new EventEmitter();
  held.json = () => {}; held.statusCode = 200;
  limiter({ baseUrl: '/api/customer', ip: '127.0.0.1' }, held, () => {});
  assert.equal(attempt(limiter).res.statusCode, 429);
  held.emit('close');
  assert.equal(attempt(limiter).res.statusCode, 429);
  held.statusCode = 500;
  held.json({ success: false });
  assert.equal(attempt(limiter).called, true);
});

test('disconnect then failed auth counts once, repeated disconnects reach 429', () => {
  const limiter = createLimiter({ windowMs: 10000 });
  for (let i = 0; i < 5; i++) {
    const res = new EventEmitter();
    res.statusCode = 200; res.json = () => {};
    let entered = false;
    limiter({ baseUrl: '/api/customer', ip: '127.0.0.1' }, res, () => { entered = true; });
    assert.equal(entered, true);
    res.emit('close'); res.emit('close');
    res.json({ success: false }); res.json({ success: false });
  }
  assert.equal(attempt(limiter).res.statusCode, 429);
});

test('hung/abandoned attempts expire without retaining pending entries forever', async () => {
  let time = 0;
  const limiter = createLimiter({ windowMs: 100, maxEntries: 1, now: () => time, pendingTimeoutMs: 5 });
  const res = new EventEmitter(); res.statusCode = 200; res.json = () => {};
  limiter({ ip: '127.0.0.1' }, res, () => {});
  await new Promise(resolve => setTimeout(resolve, 15));
  time = 101;
  assert.equal(attempt(limiter).called, true);
});
