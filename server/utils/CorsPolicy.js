const { CLIENT_URL } = require('./MyConstants');

function normalizeOrigin(value, allowPath = false) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    if (!allowPath && (url.pathname !== '/' || url.search || url.hash)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

// CLIENT_URL may include a path; CORS compares only its origin.
// Local origins include Express-served builds and both React dev servers.
const allowedOrigins = new Set([
  ...['localhost', '127.0.0.1'].flatMap(host =>
    [3000, 3001, 3002].map(port => `http://${host}:${port}`)
  ),
  normalizeOrigin(CLIENT_URL, true)
].filter(Boolean));

function isAllowedOrigin(origin) {
  return origin === undefined || allowedOrigins.has(normalizeOrigin(origin));
}

module.exports = {
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin));
  },
  // Socket.IO CORS alone does not restrict WebSocket handshakes.
  allowRequest(req, callback) {
    callback(null, isAllowedOrigin(req.headers.origin));
  }
};
