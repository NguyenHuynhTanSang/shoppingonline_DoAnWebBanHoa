const test = require('node:test');
const assert = require('node:assert/strict');

test('operator notifications authenticate rooms, reach two admins/staff, reject spoofing and recheck accounts', async t => {
  const jwt = require('jsonwebtoken');
  const { io: client } = require('../../client-admin/node_modules/socket.io-client');
  const ids = { admin: '111111111111111111111111', staff: '222222222222222222222222', customer: '333333333333333333333333' };
  let staffActive = 1;
  const query = value => ({ select() { return this; }, lean() { return this; }, async exec() { return value; } });
  for (const [name, exports] of Object.entries({
    '../utils/MyConstants': { JWT_SECRET: 'notification-test-secret' },
    '../models/Models': {
      Admin: { findById: () => query({}) }, Staff: { findById: () => query({ active: staffActive }) },
      Customer: { findById: () => query({ active: 1 }) }
    }
  })) {
    const path = require.resolve(name), old = require.cache[path];
    require.cache[path] = { exports };
    t.after(() => { if (old) require.cache[path] = old; else delete require.cache[path]; });
  }
  const realtime = require('../realtime/supportChat');
  const server = require('http').createServer();
  const io = realtime.attach(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const sockets = [];
  t.after(async () => { sockets.forEach(socket => socket.disconnect()); await new Promise(resolve => io.close(resolve)); });
  const token = role => jwt.sign({ sub: ids[role], role }, 'notification-test-secret', { expiresIn: '1h' });
  async function connect(auth) {
    const socket = client(`http://127.0.0.1:${server.address().port}`, { auth, reconnection: false });
    sockets.push(socket);
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    return socket;
  }
  await assert.rejects(connect({ token: jwt.sign({ sub: ids.admin, role: 'admin' }, 'forged-secret') }));
  const first = await connect({ token: token('admin') });
  const second = await connect({ token: token('admin') });
  const staff = await connect({ token: token('staff') });
  const customer = await connect({ token: token('customer'), role: 'admin', room: 'support-admins' });
  assert.equal(io.sockets.sockets.get(customer.id).rooms.has('support-admins'), false);
  assert.equal(io.sockets.sockets.get(first.id).rooms.has('support-admins'), true);
  const rejected = await new Promise(resolve => customer.timeout(2000).emit('support:join', { supportRequestId: 'support-admins' }, (error, result) => resolve(result)));
  assert.equal(rejected.ok, false);
  const received = [];
  first.on('support:new', data => received.push(data));
  let leaked = false;
  customer.on('support:new', () => { leaked = true; });
  const request = { _id: '444444444444444444444444', status: 'pending', category: 'staff', email: 'private@example.test', customerMessage: 'private' };
  customer.emit('support:new', request);
  customer.emit('join', 'support-admins');
  const deliveries = [first, second, staff].map(socket => new Promise(resolve => socket.once('support:new', resolve)));
  await realtime.publishAdmins('support:new', request);
  for (const payload of await Promise.all(deliveries)) assert.deepEqual(payload, { supportRequestId: request._id, status: 'pending', category: 'staff' });
  // Flush prior packets on the customer's connection before checking absence of leaks/spoofs.
  await new Promise(resolve => customer.timeout(2000).emit('support:join', { supportRequestId: 'invalid' }, resolve));
  assert.equal(leaked, false);
  assert.equal(received.length, 1);
  for (const status of ['in_progress', 'resolved']) {
    const changes = [first, second, staff].map(socket => new Promise(resolve => socket.once('support:updated', resolve)));
    await realtime.publishAdmins('support:updated', { ...request, status });
    for (const payload of await Promise.all(changes)) assert.deepEqual(payload, { supportRequestId: request._id, status });
  }
  staffActive = 0;
  await realtime.publishAdmins('support:updated', { ...request, status: 'resolved' });
  assert.equal(io.sockets.sockets.get(staff.id).rooms.has('support-admins'), false);
});
