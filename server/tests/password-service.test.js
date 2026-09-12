const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { hashPassword, verifyPassword, isBcryptHash, classifyStoredPassword } = require('../services/PasswordService');

test('verification cost ceiling rejects expensive hashes before compare without legacy fallback', async (t) => {
  // Synthetic hashes are syntax-valid; no expensive bcrypt work is performed.
  const compare = t.mock.method(bcrypt, 'compare', async () => true);
  try {
    for (const cost of [11, 12, 13, 31]) {
      const hash = `$2b$${cost}$${'.'.repeat(53)}`;
      assert.equal(isBcryptHash(hash), true);
      assert.equal(classifyStoredPassword(hash), 'bcrypt');
      const callsBefore = compare.mock.callCount();
      assert.equal(await verifyPassword('synthetic-password', hash), cost <= 12);
      assert.equal(compare.mock.callCount() - callsBefore, cost <= 12 ? 1 : 0);
      if (cost <= 12) {
        assert.deepEqual(compare.mock.calls.at(-1).arguments, ['synthetic-password', hash]);
      }
    }
  } finally {
    compare.mock.restore();
  }
});

test('new passwords receive salted cost-10 hashes and verify correctly', async () => {
  const plain = 'synthetic-password';
  const first = await hashPassword(plain);
  const second = await hashPassword(plain);
  assert.notEqual(first, plain);
  assert.notEqual(first, second);
  assert.equal(bcrypt.getRounds(first), 10);
  for (const hash of [first, second]) {
    assert.equal(isBcryptHash(hash), true);
    assert.equal(classifyStoredPassword(hash), 'bcrypt');
    assert.equal(await verifyPassword(plain, hash), true);
    assert.equal(await verifyPassword('wrong-password', hash), false);
    for (const prefix of ['$2a$', '$2b$', '$2y$']) {
      const revision = prefix + hash.slice(4);
      assert.equal(isBcryptHash(revision), true);
      assert.equal(await verifyPassword(plain, revision), true);
    }
  }
});

test('invalid types, short passwords and malformed stored values fail safely', async () => {
  for (const value of [null, undefined, {}, [], 123456, true]) {
    await assert.rejects(hashPassword(value), TypeError);
    assert.equal(await verifyPassword(value, 'invalid'), false);
    assert.equal(classifyStoredPassword(value), 'invalid');
    assert.equal(isBcryptHash(value), false);
  }
  for (const value of ['', '12345']) await assert.rejects(hashPassword(value), RangeError);
  const valid = await hashPassword('abcdef');
  for (const value of ['$2', '$2b$10$broken', valid.slice(0, -1), valid + 'x', valid.replace('$2b$', '$2x$'), valid.replace('$10$', '$03$'), valid.replace('$10$', '$32$'), valid.slice(0, -1) + '!']) {
    assert.equal(isBcryptHash(value), false);
    assert.equal(classifyStoredPassword(value), 'invalid_bcrypt_like');
    assert.equal(await verifyPassword('abcdef', value), false);
  }
  assert.equal(classifyStoredPassword('legacy-password'), 'legacy_plaintext');
  assert.equal(classifyStoredPassword(''), 'invalid');
  assert.equal(await verifyPassword('legacy-password', 'legacy-password'), false);
});

test('UTF-8 72-byte boundary is enforced without truncation or trimming', async () => {
  for (const plain of ['a'.repeat(72), 'é'.repeat(36), '🌸'.repeat(18)]) {
    assert.equal(Buffer.byteLength(plain, 'utf8'), 72);
    const hash = await hashPassword(plain);
    assert.equal(await verifyPassword(plain, hash), true);
    await assert.rejects(hashPassword(plain + 'a'), RangeError);
    assert.equal(await verifyPassword(plain + 'a', hash), false);
  }
  await assert.rejects(hashPassword('🌸'.repeat(19)), RangeError);
  const spaced = await hashPassword(' abcdef ');
  assert.equal(await verifyPassword(' abcdef ', spaced), true);
  assert.equal(await verifyPassword('abcdef', spaced), false);
});

test('hash-looking NEW input is hashed; unchanged stored values are a caller responsibility', async () => {
  const stored = await hashPassword('synthetic-password');
  const newHash = await hashPassword(stored);
  assert.notEqual(newHash, stored);
  assert.equal(await verifyPassword(stored, newHash), true);
  assert.equal(await verifyPassword('synthetic-password', newHash), false);
  // Classifying an existing value is read-only, never an automatic migration.
  assert.equal(classifyStoredPassword(stored), 'bcrypt');
  assert.equal(await verifyPassword('synthetic-password', stored), true);
});
