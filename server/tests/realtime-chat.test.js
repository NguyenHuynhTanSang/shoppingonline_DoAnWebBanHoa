const test = require('node:test');
const assert = require('node:assert/strict');
test('real Socket.IO transport: JWT/rooms, two-way persisted chat, retries, history and resolved', async t => {
  const jwt = require('jsonwebtoken');
  const { io: client } = require('../../client-customer/node_modules/socket.io-client');
  const owner = '111111111111111111111111', other = '222222222222222222222222';
  const staff = '333333333333333333333333', requestId = '444444444444444444444444';
  const request = { _id: requestId, customerId: owner, assignedTo: { id: staff, role: 'staff' }, status: 'pending', chatSequence: 0 };
  const messages = [];
  let failResolve = false;
  const query = value => ({ maxTimeMS() { return this; }, select() { return this; }, lean() { return this; }, sort() { return this; }, limit() { return this; }, session() { return this; }, async exec() { return typeof value === 'function' ? value() : value; } });
  const models = {
    Customer: { findById: () => query({ active: 1 }) }, Staff: { findById: () => query({ active: 1 }) }, Admin: { findById: () => query({}) },
    SupportRequest: {
      findById: id => query(id === requestId ? { ...request } : null),
      findOne: filter => query(filter.customerId === owner && (!filter.status || filter.status === request.status) ? { ...request } : null),
      findOneAndUpdate: (filter, update) => query(() => {
        if (update.$set && failResolve) throw new Error('test persistence failure');
        if (filter._id !== requestId || request.status !== filter.status || (filter.customerId && filter.customerId !== owner) ||
            (filter['assignedTo.id'] && filter['assignedTo.id'] !== staff)) return null;
        if (update.$set) { Object.assign(request, update.$set); return { ...request }; }
        return { ...request, chatSequence: ++request.chatSequence };
      })
    },
    SupportMessage: {
      findOne: filter => query(messages.find(row => Object.entries(filter).every(([key, value]) => row[key] === value)) || null),
      find: filter => query(messages.filter(row => row.supportRequestId === filter.supportRequestId && (!filter.sequence || row.sequence < filter.sequence.$lt)).slice().sort((a,b) => b.sequence-a.sequence).slice(0,50)),
      async create([data]) { const row = { ...data, _id: String(messages.length + 1), createdAt: new Date() }; messages.push(row); return [{ toObject: () => row }]; }
    }
  };
  for (const [name, exports] of Object.entries({ '../models/Models': models, '../utils/MyConstants': { JWT_SECRET: 'realtime-test-secret' } })) {
    const path = require.resolve(name), previous = require.cache[path];
    require.cache[path] = { exports };
    t.after(() => { if (previous) require.cache[path] = previous; else delete require.cache[path]; });
  }
  t.mock.method(require('mongoose'), 'startSession', async () => ({ async withTransaction(callback) { await callback(); }, async endSession() {} }));
  const service = require('../services/SupportChatService');
  const toolPath = require.resolve('../services/ai/tools/ProductSearchTool');
  const oldTool = require.cache[toolPath];
  require.cache[toolPath] = { exports: { async searchProducts() { return [{ id: 'product', name: 'Hoa thử nghiệm', price: 500000, stock: 2, image: null, category: null }]; } } };
  t.after(() => { if (oldTool) require.cache[toolPath] = oldTool; else delete require.cache[toolPath]; });
  const realtime = require('../realtime/supportChat');
  const app = require('express')(); app.use(require('express').json());
  app.use('/api/support-chat', require('../api/supportChat'));
  app.use('/api/ai', require('../api/ai'));
  app.use('/api/admin/support-requests', require('../api/support'));
  const server = require('http').createServer(app); const socketServer = realtime.attach(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const sockets = [];
  t.after(async () => { sockets.forEach(socket => socket.disconnect()); await new Promise(resolve => socketServer.close(resolve)); });
  const token = (id, role) => jwt.sign({ sub: id, role }, 'realtime-test-secret', { expiresIn: '1h' });
  async function connect(authToken) {
    const socket = client(base, { auth: { token: authToken }, reconnection: false }); sockets.push(socket);
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); }); return socket;
  }
  const emit = (socket, event, payload) => new Promise((resolve, reject) => socket.timeout(3000).emit(event, payload, (error, result) => error ? reject(error) : resolve(result)));
  await assert.rejects(connect(jwt.sign({ sub: owner, role: 'admin' }, 'fake-key')));
  await assert.rejects(connect(jwt.sign({ sub: owner, role: 'customer' }, 'realtime-test-secret', { expiresIn: -1 })));
  async function askAI() {
    const response = await fetch(`${base}/api/ai/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token(owner, 'customer')}` }, body: JSON.stringify({ message: 'Tìm hoa dưới 1 triệu' }) });
    return response.json();
  }
  assert.equal((await askAI()).type, 'product_recommendation');
  const customer = await connect(token(owner, 'customer'));
  const operator = await connect(token(staff, 'staff'));
  const stranger = await connect(token(other, 'customer'));
  const wrongStaff = await connect(token(other, 'staff'));
  assert.equal((await emit(stranger, 'support:join', { supportRequestId: requestId })).ok, false);
  assert.equal((await emit(wrongStaff, 'support:join', { supportRequestId: requestId })).ok, false);
  assert.equal((await emit(customer, 'support:join', { supportRequestId: requestId })).request.status, 'pending');
  await emit(operator, 'support:join', { supportRequestId: requestId });
  const update = new Promise(resolve => customer.once('support:status', resolve));
  request.status = 'in_progress'; await realtime.publish(requestId, 'support:status', { id: requestId, status: request.status });
  assert.equal((await update).status, 'in_progress');
  const payload = { supportRequestId: requestId, clientMessageId: 'message-0001', message: 'Xin chào nhân viên' };
  const received = new Promise(resolve => operator.once('support:message:new', resolve));
  assert.equal((await emit(customer, 'support:message', payload)).ok, true);
  assert.equal((await received).message.message, payload.message);
  await emit(customer, 'support:message', payload); assert.equal(messages.length, 1);
  const reply = new Promise(resolve => customer.once('support:message:new', resolve));
  await emit(operator, 'support:message', { ...payload, clientMessageId: 'message-0002', message: '<script>alert(1)</script>' });
  assert.equal((await reply).message.senderType, 'staff');
  for (const invalid of [{ ...payload, message: '' }, { ...payload, message: 'a'.repeat(2001) }, { ...payload, senderType: 'admin' }]) {
    assert.equal((await emit(customer, 'support:message', invalid)).ok, false);
  }
  assert.equal((await emit(stranger, 'support:message', payload)).ok, false);
  const ai = await fetch(`${base}/api/ai/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token(owner, 'customer')}` }, body: JSON.stringify({ message: 'Xin chào nhân viên' }) });
  assert.equal((await ai.json()).type, 'human_active');
  customer.disconnect();
  const reconnected = await connect(token(owner, 'customer'));
  await emit(reconnected, 'support:join', { supportRequestId: requestId });
  const history = await fetch(`${base}/api/support-chat/${requestId}/messages`, { headers: { Authorization: `Bearer ${token(owner, 'customer')}` } });
  assert.equal((await history.json()).messages.length, 2);
  assert.equal((await service.history({ id: staff, role: 'staff' }, requestId)).messages.length, 2);
  const resolveRequest = roleId => fetch(`${base}/api/admin/support-requests/${requestId}/status`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token(roleId, 'staff')}` },
    body: JSON.stringify({ status: 'resolved' })
  });
  assert.equal((await resolveRequest(other)).status, 409);
  assert.equal(request.status, 'in_progress');
  failResolve = true;
  assert.equal((await resolveRequest(staff)).status, 500);
  assert.equal(request.status, 'in_progress');
  failResolve = false;
  const resolved = new Promise(resolve => reconnected.once('support:status', resolve));
  assert.equal((await resolveRequest(staff)).status, 200);
  assert.equal((await resolved).status, 'resolved');
  assert.equal((await resolveRequest(staff)).status, 409);
  assert.ok(request.resolvedAt instanceof Date);
  assert.equal(request.resolvedBy.id, staff);
  await assert.rejects(service.send({ id: staff, role: 'admin' }, payload), { code: 'SESSION_CLOSED' });
  const statusResponse = await fetch(`${base}/api/support-chat/${requestId}/status`, { headers: { Authorization: `Bearer ${token(owner, 'customer')}` } });
  assert.equal((await statusResponse.json()).request.status, 'resolved');
  const forbidden = await fetch(`${base}/api/support-chat/${requestId}/status`, { headers: { Authorization: `Bearer ${token(other, 'customer')}` } });
  assert.equal(forbidden.status, 403);
  const afterDisconnect = await connect(token(owner, 'customer'));
  assert.equal((await emit(afterDisconnect, 'support:join', { supportRequestId: requestId })).request.status, 'resolved');
  assert.equal((await emit(afterDisconnect, 'support:message', payload)).code, 'SESSION_CLOSED');
  assert.equal((await service.history({ id: owner, role: 'customer' }, requestId)).messages.length, 2);
  assert.equal((await emit(reconnected, 'support:message', { ...payload, clientMessageId: 'message-0003' })).code, 'SESSION_CLOSED');
  assert.equal(await service.active({ id: owner, role: 'customer' }), null);
  assert.equal((await askAI()).type, 'product_recommendation');
  let limited = false;
  for (let i = 0; i < 65; i++) if ((await emit(reconnected, 'support:join', { supportRequestId: requestId })).code === 'RATE_LIMIT') limited = true;
  assert.ok(limited);
});
