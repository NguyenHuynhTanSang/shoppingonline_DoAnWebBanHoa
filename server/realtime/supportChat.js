const { Server } = require('socket.io');
const service = require('../services/SupportChatService');
let io;
const windows = new Map();
function throttle(key) {
  const now = Date.now();
  for (const [id, value] of windows) if (now - value.start > 60000) windows.delete(id);
  const entry = windows.get(key) || { start: now, count: 0 };
  windows.set(key, entry);
  if (++entry.count > 60) { const error = new Error('RATE_LIMIT'); error.code = 'RATE_LIMIT'; throw error; }
}
function safeError(error) {
  return { ok: false, code: ['AUTH_REQUIRED', 'FORBIDDEN', 'INVALID_REQUEST', 'INVALID_MESSAGE', 'SESSION_CLOSED', 'RATE_LIMIT'].includes(error.code) ? error.code : 'SUPPORT_UNAVAILABLE' };
}
async function publish(id, event, data) {
  if (!io) return;
  for (const socket of await io.in(`support:${id}`).fetchSockets()) {
    try {
      const actor = await service.authenticate(socket.data.token);
      await service.authorize(actor, id);
      socket.emit(event, data);
    } catch { socket.leave(`support:${id}`); socket.emit('support:error', { code: 'FORBIDDEN' }); }
  }
}
async function publishAdmins(event, request) {
  if (!io || !['support:new', 'support:updated'].includes(event)) return;
  const payload = { supportRequestId: String(request._id), status: request.status };
  if (event === 'support:new') payload.category = request.category;
  for (const socket of await io.in('support-admins').fetchSockets()) {
    try {
      const actor = await service.authenticate(socket.data.token);
      if (!['admin', 'staff'].includes(actor.role)) throw new Error('FORBIDDEN');
      socket.emit(event, payload);
    } catch { socket.leave('support-admins'); }
  }
}
function attach(server) {
  io = new Server(server, { maxHttpBufferSize: 12000, cors: { origin: true, methods: ['GET', 'POST'] } });
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || token.length > 4096) throw new Error();
      const actor = await service.authenticate(token);
      throttle(`connect:${actor.role}:${actor.id}`);
      socket.data.token = token;
      socket.data.supportOperator = ['admin', 'staff'].includes(actor.role);
      next();
    } catch { next(new Error('AUTH_REQUIRED')); }
  });
  io.on('connection', socket => {
    if (socket.data.supportOperator) socket.join('support-admins');
    for (const event of ['support:join', 'support:message']) socket.on(event, async (payload, ack) => {
      if (typeof ack !== 'function') return;
      try {
        const actor = await service.authenticate(socket.data.token);
        throttle(`${actor.role}:${actor.id}`);
        if (event === 'support:join') {
          const request = await service.authorize(actor, payload?.supportRequestId);
          for (const room of socket.rooms) if (room.startsWith('support:')) socket.leave(room);
          await socket.join(`support:${request._id}`);
          ack({ ok: true, request: service.view(request) });
        } else {
          const message = await service.send(actor, payload);
          await publish(payload.supportRequestId, 'support:message:new', { supportRequestId: payload.supportRequestId, message });
          ack({ ok: true, message });
        }
      } catch (error) { ack(safeError(error)); }
    });
  });
  return io;
}
module.exports = { attach, publish, publishAdmins, safeError };
