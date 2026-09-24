const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const jwt = require('jsonwebtoken');

// Evaluate the real config with an isolated environment and no .env access.
function loadConfig(env) {
  const filename = path.resolve(__dirname, '../utils/MyConstants.js');
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module,
    __dirname: path.dirname(filename),
    process: { env },
    require(name) {
      if (name === 'path') return path;
      if (name === 'dotenv') return { config() {} };
      throw new Error('Unexpected config dependency');
    }
  }, { filename });
  return module.exports;
}

for (const [label, env] of [
  ['missing', {}],
  ['empty', { JWT_SECRET: '' }],
  ['whitespace', { JWT_SECRET: ' \t\n' }]
]) {
  test(`config fails closed for ${label} JWT_SECRET`, () => {
    assert.throws(() => loadConfig(env), { message: 'JWT_SECRET is required' });
  });
}

test('synthetic secret is preserved and JwtUtil signs/verifies with existing expiry', () => {
  const config = loadConfig({ JWT_SECRET: ' synthetic-test-only-secret ', JWT_EXPIRES: '1h' });
  assert.equal(config.JWT_SECRET, ' synthetic-test-only-secret ');
  const filename = path.resolve(__dirname, '../utils/JwtUtil.js');
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module,
    require(name) {
      if (name === 'jsonwebtoken') return jwt;
      if (name === './MyConstants') return config;
      throw new Error('Unexpected JWT dependency');
    }
  }, { filename });
  const token = module.exports.genToken({ sub: 'synthetic-user', role: 'customer' });
  const decoded = module.exports.verifyToken(token);
  assert.equal(decoded.sub, 'synthetic-user');
  assert.equal(decoded.role, 'customer');
  assert.equal(decoded.exp - decoded.iat, 3600);
  assert.equal(loadConfig({ JWT_SECRET: 'synthetic-test-only-secret' }).JWT_EXPIRES, '7d');
});
