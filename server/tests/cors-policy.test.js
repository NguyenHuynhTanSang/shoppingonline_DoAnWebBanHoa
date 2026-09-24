const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadPolicy() {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../utils/CorsPolicy.js'), 'utf8'), {
    module, URL,
    require(name) {
      assert.equal(name, './MyConstants');
      return { CLIENT_URL: 'https://SHOP.example:443/customer/' };
    }
  });
  return module.exports;
}

test('HTTP and Socket handshake share exact origin decisions without real environment', () => {
  const policy = loadPolicy();
  for (const [origin, allowed] of [
    ['https://shop.example', true], ['https://SHOP.example:443', true],
    ['http://localhost:3001', true], ['http://localhost:3002', true],
    ['http://127.0.0.1:3001', true], ['http://127.0.0.1:3002', true],
    [undefined, true], ['https://untrusted.example', false],
    ['https://shop.example.attacker.test', false], ['https://evilshop.example', false],
    ['https://shop.example@attacker.test', false], ['http://localhost:30010', false],
    ['null', false], ['', false], ['*', false], ['https://shop.example/path', false]
  ]) {
    policy.origin(origin, (error, result) => { assert.equal(error, null); assert.equal(result, allowed); });
    policy.allowRequest({ headers: { origin } }, (error, result) => { assert.equal(error, null); assert.equal(result, allowed); });
  }
});

test('real HTTP CORS emits headers only for allowed origins; no-Origin remains usable', async t => {
  const app = require('express')();
  app.use(require('cors')({ origin: loadPolicy().origin }));
  app.get('/', (req, res) => res.send('ok'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  for (const origin of ['https://shop.example', 'https://attacker.test', undefined]) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/`, {
      headers: origin ? { Origin: origin } : {}
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), origin === 'https://shop.example' ? origin : null);
    await response.text();
  }
});

test('production HTTP and Socket.IO wiring uses shared policy', () => {
  const index = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');
  const socket = fs.readFileSync(path.join(__dirname, '../realtime/supportChat.js'), 'utf8');
  assert.match(index, /cors\(\{ origin: require\('\.\/utils\/CorsPolicy'\)\.origin \}\)/);
  assert.match(socket, /require\('\.\.\/utils\/CorsPolicy'\)/);
  assert.match(socket, /origin: corsPolicy\.origin/);
  assert.match(socket, /allowRequest: corsPolicy\.allowRequest/);
});
