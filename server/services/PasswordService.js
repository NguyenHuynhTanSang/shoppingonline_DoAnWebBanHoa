const bcrypt = require('bcryptjs');

// Foundation default: 2^10 rounds. Benchmark on deployment hardware before
// enabling production writes/login; raising this cost belongs to that rollout.
const COST = 10;
// Backend policy: allow two cost steps above new hashes (4x the rounds).
// Syntax classification remains independent of this workload ceiling.
const MAX_BCRYPT_VERIFY_COST = 12;
const MAX_BYTES = 72;
// bcryptjs 3.x supports these revisions and costs 04..31. Require canonical
// base64 padding bits for the 16-byte salt and 23-byte checksum as well.
const HASH_PATTERN = /^\$2[aby]\$(?:0[4-9]|[12][0-9]|3[01])\$[./A-Za-z0-9]{21}[.Oeu][./A-Za-z0-9]{30}[.CGKOSWaeimquy26]$/;

function isBcryptHash(value) {
  return typeof value === 'string' && value.length === 60 && HASH_PATTERN.test(value);
}

function classifyStoredPassword(value) {
  if (typeof value !== 'string' || value.length === 0) return 'invalid';
  if (isBcryptHash(value)) return 'bcrypt';
  if (value.startsWith('$2')) return 'invalid_bcrypt_like';
  return 'legacy_plaintext';
}

/**
 * Only NEW USER INPUT belongs here. Never pass an unchanged stored password
 * back into this function. In particular, a staff edit with no new password
 * must omit the write and preserve the stored value in its caller.
 * Hash-looking user input is still plaintext and always receives a fresh salt.
 * No trimming/normalization: callers must deliberately choose their policy.
 */
async function hashPassword(plainPassword) {
  if (typeof plainPassword !== 'string') throw new TypeError('Password must be a string');
  if (plainPassword.length < 6) throw new RangeError('Password must contain at least 6 characters');
  if (Buffer.byteLength(plainPassword, 'utf8') > MAX_BYTES) {
    throw new RangeError('Password must not exceed 72 UTF-8 bytes');
  }
  return bcrypt.hash(plainPassword, COST);
}

// Verification intentionally does not enforce the new-password minimum.
// It never falls back to comparing a stored plaintext value.
async function verifyPassword(plainPassword, storedHash) {
  if (typeof plainPassword !== 'string' ||
      Buffer.byteLength(plainPassword, 'utf8') > MAX_BYTES || !isBcryptHash(storedHash)) return false;
  const cost = Number(storedHash.slice(4, 6));
  if (cost > MAX_BCRYPT_VERIFY_COST) return false;
  try {
    return await bcrypt.compare(plainPassword, storedHash);
  } catch {
    return false;
  }
}

// Read compatibility only: callers preserve their existing input normalization.
// No hashing, migration, or persistence occurs on this path.
async function verifyLoginPassword(plainPassword, storedPassword) {
  if (typeof plainPassword !== 'string') return false;
  const classification = classifyStoredPassword(storedPassword);
  if (classification === 'bcrypt') return verifyPassword(plainPassword, storedPassword);
  if (classification === 'legacy_plaintext') return plainPassword === storedPassword;
  return false;
}

// Called after credential verification and the route's existing status checks.
// Infrastructure errors intentionally propagate to the generic login error
// handler: never issue a JWT with an unresolved migration race.
async function migrateLegacyLogin(account, suppliedPassword, dao, isAllowed) {
  if (!account || !isAllowed(account)) return null;
  if (classifyStoredPassword(account.password) !== 'legacy_plaintext') return account;
  if (!await verifyLoginPassword(suppliedPassword, account.password)) return null;
  // Preserve old login compatibility for credentials outside new-write policy.
  if (suppliedPassword.length < 6 || Buffer.byteLength(suppliedPassword, 'utf8') > MAX_BYTES) return account;
  const expected = account.password;
  const newHash = await module.exports.hashPassword(suppliedPassword);
  const updated = await dao.migrateLegacyPasswordIfUnchanged(account._id, expected, newHash);
  if (updated) return String(updated._id) === String(account._id) && isAllowed(updated) ? updated : null;
  const current = await dao.selectByID(account._id);
  if (!current || String(current._id) !== String(account._id) || !isAllowed(current)) return null;
  return await verifyLoginPassword(suppliedPassword, current.password) ? current : null;
}

module.exports = { hashPassword, verifyPassword, isBcryptHash, classifyStoredPassword, verifyLoginPassword, migrateLegacyLogin };
