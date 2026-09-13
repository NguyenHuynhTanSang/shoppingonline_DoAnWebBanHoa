const test = require('node:test');
const assert = require('node:assert/strict');
const { detectHandoff, createHandoff } = require('../services/ai/HandoffService');
test('DAO checks only same customer/order/category and open statuses', async t => {
  const modelsPath = require.resolve('../models/Models');
  const daoPath = require.resolve('../models/SupportRequestDAO');
  const oldModels = require.cache[modelsPath];
  const oldDAO = require.cache[daoPath];
  t.after(() => {
    if (oldModels) require.cache[modelsPath] = oldModels; else delete require.cache[modelsPath];
    if (oldDAO) require.cache[daoPath] = oldDAO; else delete require.cache[daoPath];
  });
  let query;
  require.cache[modelsPath] = { exports: { SupportRequest: {
    findOne(filter) {
      query = filter;
      return { select() { return this; }, maxTimeMS() { return this; }, lean() { return this; }, async exec() { return null; } };
    },
    async create(data) { return data; }
  } } };
  delete require.cache[daoPath];
  const dao = require('../models/SupportRequestDAO');
  const criteria = { customerId: 'customer', orderId: 'order', category: 'refund' };
  await dao.selectOpen(criteria);
  assert.deepEqual(query, { ...criteria, status: { $in: ['pending', 'in_progress'] } });
  const saved = await dao.insert({ ...criteria, customerMessage: 'message', status: 'resolved', source: 'untrusted' });
  assert.equal(saved.status, 'pending');
  assert.equal(saved.source, 'ai_chat');
});
test('detects incidents and staff requests, preserves ordinary advice/policy questions', () => {
  assert.equal(detectHandoff('Shop giao sai hoa, tôi muốn hoàn tiền'), 'wrong_product');
  assert.equal(detectHandoff('Tôi yêu cầu hoàn tiền'), 'refund');
  assert.equal(detectHandoff('Tôi muốn gặp nhân viên'), 'staff');
  assert.equal(detectHandoff('Hoa bị hư hỏng'), 'damaged_product');
  assert.equal(detectHandoff('Thanh toán bị lỗi'), 'payment');
  assert.equal(detectHandoff('Giao chậm quá'), 'delivery');
  assert.equal(detectHandoff('Giao hàng thất bại'), 'delivery');
  assert.equal(detectHandoff('Sản phẩm không giống mô tả'), 'wrong_product');
  assert.equal(detectHandoff('Shop mở cửa mấy giờ?'), null);
  assert.equal(detectHandoff('Tư vấn hoa sinh nhật'), null);
  assert.equal(detectHandoff('Tìm hoa tulip dưới 1 triệu'), null);
  assert.equal(detectHandoff('Chính sách hoàn tiền như thế nào?'), null);
});
test('creates only after identity/ownership validation and successful persistence', async t => {
  const owner = '111111111111111111111111';
  const order = '222222222222222222222222';
  const supportId = '333333333333333333333333';
  const writes = [];
  const notifications = [];
  const realtimePath = require.resolve('../realtime/supportChat');
  const oldRealtime = require.cache[realtimePath];
  require.cache[realtimePath] = { exports: { async publishAdmins(event, payload) {
    assert.equal(writes.length, notifications.length + 1);
    notifications.push({ event, payload });
  } } };
  t.after(() => { if (oldRealtime) require.cache[realtimePath] = oldRealtime; else delete require.cache[realtimePath]; });
  let fail = false;
  let resolvedPrevious = false;
  for (const [name, exports] of Object.entries({
    CustomerDAO: { async selectByID() { return { active: 1 }; } },
    OrderDAO: { async selectStatusForCustomer(id, customer) { return id === order && customer === owner ? { _id: id } : null; } },
    SupportRequestDAO: {
      async selectOpen(criteria) { if (fail || resolvedPrevious) return null; return writes.some(row => row.customerId === criteria.customerId && row.orderId === criteria.orderId && row.category === criteria.category) ? { _id: supportId } : null; },
      async insert(data) { if (fail) throw Error('private'); writes.push(data); return { _id: supportId }; }
    }
  })) {
    const resolved = require.resolve(`../models/${name}`);
    const previous = require.cache[resolved];
    require.cache[resolved] = { exports };
    t.after(() => { if (previous) require.cache[resolved] = previous; else delete require.cache[resolved]; });
  }
  const token = { sub: owner, role: 'customer' };
  assert.equal((await createHandoff({}, 'Tôi muốn gặp nhân viên')).status, 403);
  const prompt = await createHandoff(token, 'Shop giao sai hoa, tôi muốn hoàn tiền');
  assert.equal(prompt.body.supportRequestId, null);
  assert.equal(prompt.body.type, 'human_handoff_required');
  assert.equal(writes.length, 0);
  const success = await createHandoff(token, order, prompt.body.supportContext);
  assert.equal(success.body.supportRequestId, supportId);
  assert.equal(writes[0].customerId, owner);
  assert.equal(writes[0].orderId, order);
  const duplicate = await createHandoff(token, order, prompt.body.supportContext);
  assert.equal(duplicate.body.supportRequestId, supportId);
  assert.equal(writes.length, 1);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].event, 'support:new');
  assert.deepEqual(Object.keys(notifications[0].payload).sort(), ['_id', 'category', 'status']);
  const otherCustomer = await createHandoff({ sub: '555555555555555555555555', role: 'customer' }, `Shop giao sai hoa ${order}`);
  assert.equal(otherCustomer.body.supportRequestId, null);
  assert.equal(writes.length, 1);
  const foreign = await createHandoff(token, 'Tôi muốn hoàn tiền đơn 444444444444444444444444');
  assert.equal(foreign.body.supportRequestId, null);
  assert.equal(writes.length, 1);
  const staff = await createHandoff(token, 'Tôi muốn gặp nhân viên. OTP: 123456 email: test@example.com');
  assert.equal(staff.body.supportRequestId, supportId);
  assert.equal(writes[1].orderId, null);
  assert.ok(!writes[1].customerMessage.includes('123456'));
  assert.ok(!writes[1].customerMessage.includes('test@example.com'));
  resolvedPrevious = true;
  const newRequest = await createHandoff(token, 'Tôi muốn gặp nhân viên');
  assert.equal(newRequest.status, 200);
  assert.equal(writes.length, 3);
  fail = true;
  const failure = await createHandoff(token, 'Tôi muốn gặp nhân viên');
  assert.equal(failure.status, 503);
  assert.equal(failure.body.supportRequestId, null);
  assert.equal(notifications.length, 3);
  assert.match(failure.body.reply, /Chưa thể/);
  assert.ok(!failure.body.reply.includes('private'));
});
