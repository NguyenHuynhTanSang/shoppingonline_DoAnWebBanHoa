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

module.exports = { hashPassword, verifyPassword, isBcryptHash, classifyStoredPassword };
