const { createHash } = require('node:crypto');

// Process-local, bounded fixed windows. Never trust forwarded IP headers here:
// req.ip follows Express's deployment-controlled trust-proxy setting.
function createLimiter({ limit = 5, windowMs, identity = false, allRequests = false, maxEntries = 10000, now = Date.now, pendingTimeoutMs = 60000 }) {
  const entries = new Map();
  return function limitAuth(req, res, next) {
    const time = now();
    for (const [key, entry] of entries) if (entry.expires <= time && entry.pending === 0) entries.delete(key);
    const user = identity ? String(req.body?.username || req.body?.email || '').trim().toLowerCase() : '';
    const key = createHash('sha256').update(JSON.stringify([req.baseUrl || '', req.ip || req.socket?.remoteAddress || 'unknown', user])).digest('hex');
    let entry = entries.get(key);
    function reject(expires) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((expires - time) / 1000))));
      return res.status(429).json({ success: false, message: 'Too many attempts. Please try again later.' });
    }
    if (!entry) {
      if (entries.size >= maxEntries) return reject(time + windowMs);
      entry = { failures: 0, pending: 0, unresolved: 0, expires: time + windowMs };
      entries.set(key, entry);
    }
    if (entry.failures + entry.pending + entry.unresolved >= limit) return reject(entry.expires);
    if (allRequests) {
      entry.failures++;
      return next();
    }
    entry.pending++;
    let done = false;
    let released = false;
    const json = res.json;
    // A closed connection is not an authentication result. Reserve its attempt
    // until a result arrives or the fixed window expires. Bound hung handlers.
    function releasePending() {
      if (done || released) return;
      released = true;
      entry.pending--;
      entry.unresolved++;
      clearTimeout(timer);
    }
    const timer = setTimeout(releasePending, pendingTimeoutMs);
    timer.unref();
    function finish(body) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (released) entry.unresolved--;
      else entry.pending--;
      if (res.statusCode < 500 && body?.success === false) entry.failures++;
      else if (res.statusCode < 400 && body?.success === true) entry.failures = 0;
    }
    res.json = function (body) { finish(body); return json.call(this, body); };
    res.once('close', releasePending);
    next();
  };
}

module.exports = {
  createLimiter,
  login: createLimiter({ windowMs: 5 * 60 * 1000, identity: true }),
  forgot: createLimiter({ windowMs: 15 * 60 * 1000, allRequests: true }),
  reset: createLimiter({ windowMs: 15 * 60 * 1000 })
};
