const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { configureTrustedProxy } = require('../utils/TrustedProxy');
const { createLimiter } = require('../utils/AuthRateLimit');

test('proxy config rejects trust-all and malformed values', () => {
  for (const value of ['true', '*', '1', '0.0.0.0/0', '::/0', 'loopback', '127.0.0.1/33', '127.0.0.1,']) {
    assert.throws(() => configureTrustedProxy(express(), value));
  }
  const app = express(); configureTrustedProxy(app, '');
  assert.equal(app.get('trust proxy'), false);
});

test('real Express IP resolution: spoofed forwarding ignored unless socket peer is explicitly trusted', async () => {
  for (const trusted of ['', '127.0.0.1/32']) {
    const app = express(); configureTrustedProxy(app, trusted);
    app.get('/ip', (req, res) => res.json({ ip: req.ip }));
    for (const [route, allRequests] of [['/forgot', true], ['/reset', false]]) {
      app.post(route, createLimiter({ limit: 1, windowMs: 10000, allRequests }), (req, res) => res.json({ success: false }));
    }
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const request = (route, ip) => fetch(`http://127.0.0.1:${server.address().port}${route}`, {
      method: route === '/ip' ? 'GET' : 'POST', headers: { 'X-Forwarded-For': ip }
    });
    try {
      const first = await (await request('/ip', '198.51.100.1')).json();
      const second = await (await request('/ip', '198.51.100.2')).json();
      assert.equal(first.ip, trusted ? '198.51.100.1' : '127.0.0.1');
      assert.equal(second.ip, trusted ? '198.51.100.2' : '127.0.0.1');
      // Attacker-supplied leftmost entry cannot bypass the nearest untrusted hop.
      assert.equal((await (await request('/ip', '203.0.113.9, 198.51.100.1')).json()).ip, trusted ? '198.51.100.1' : '127.0.0.1');
      for (const route of ['/forgot', '/reset']) {
        assert.equal((await request(route, '198.51.100.1')).status, 200);
        assert.equal((await request(route, '198.51.100.1')).status, 429);
        assert.equal((await request(route, '198.51.100.2')).status, trusted ? 200 : 429);
      }
    } finally { await new Promise(resolve => server.close(resolve)); }
  }
});
