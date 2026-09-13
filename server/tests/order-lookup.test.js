const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
function load(file, dependencies) {
  const module = { exports: {} };
  new Function('require', 'module', fs.readFileSync(path.join(__dirname, '..', file), 'utf8'))(name => {
    if (!(name in dependencies)) throw Error(`Unexpected dependency ${name}`);
    return dependencies[name];
  }, module);
  return module.exports;
}
const owner = '111111111111111111111111', id = '222222222222222222222222';
test('friendly focused replies answer the exact requested topics from fresh tool data', async () => {
  const row = { _id: id, status: 'canceled', cdate: Date.UTC(2026, 2, 24, 9, 55), total: 830000, paymentStatus: 'unpaid', customerInfo: { paymentMethod: 'cod' }, items: [{ product: { name: 'Hoa tulip', description: 'PRIVATE' }, quantity: 2 }] };
  const service = load('services/ai/OrderStatusService.js', {
    '../../utils/PaymentPolicy': require('../utils/PaymentPolicy'),
    './HandoffService': require('../services/ai/HandoffService'),
    '../../models/CustomerDAO': { async selectByID() { return { active: 1 }; } },
    '../../models/OrderDAO': { async lookupForAssistant() { return { orders: [row], total: null }; } }
  });
  const context = {}, actor = { sub: owner, role: 'customer' };
  const ask = async message => (await service.getOrderStatus(actor, message, context)).body.reply;
  const status = await ask('Đơn gần nhất của tôi sao rồi?');
  assert.match(status, /đã hủy/); assert.doesNotMatch(status, /830|thanh toán|2026|Phương thức/);
  assert.equal(await ask('Đơn đó tổng bao nhiêu?'), 'Tổng đơn của bạn là 830.000đ.');
  const payment = await ask('Đơn đó thanh toán chưa?');
  assert.match(payment, /chưa thanh toán/); assert.match(payment, /khi nhận hàng/); assert.doesNotMatch(payment, /830|đã hủy|2026/);
  row.paymentStatus = 'Đã thanh toán demo';
  const legacyPayment = await ask('Đơn đó thanh toán chưa?');
  assert.match(legacyPayment, /demo - chưa xác minh/);
  assert.doesNotMatch(legacyPayment, /Đã thanh toán demo/);
  assert.equal(row.paymentStatus, 'Đã thanh toán demo');
  row.paymentStatus = 'unpaid';
  const date = await ask('Tôi đặt đơn đó khi nào?');
  assert.match(date, /24\/03\/2026/); assert.match(date, /16:55/); assert.doesNotMatch(date, /T09:55|830|thanh toán/);
  const items = await ask('Đơn đó gồm những gì?');
  assert.match(items, /Hoa tulip: 2/); assert.doesNotMatch(items, /PRIVATE|830|thanh toán|2026/);
  const summary = await ask('Cho tôi toàn bộ thông tin đơn đó');
  for (const value of ['830.000đ', 'đã hủy', '24/03/2026', 'Hoa tulip: 2', 'chưa thanh toán', id]) assert.ok(summary.includes(value));
  const combined = await ask('Đơn đó tổng bao nhiêu và thanh toán chưa?');
  assert.match(combined, /830.000đ/); assert.match(combined, /chưa thanh toán/); assert.doesNotMatch(combined, /Hoa tulip|24\/03/);
  row.total = null; row.cdate = null; row.paymentStatus = null; row.items = [];
  assert.match(await ask('Đơn đó tổng bao nhiêu?'), /chưa có thông tin xác nhận/);
  assert.match(await ask('Đơn đó gồm những gì?'), /chưa có thông tin sản phẩm/);
});
test('order tool validates every filter, scopes lists/counts/cursors and bounds DB reads', async () => {
  const calls = [];
  const chain = result => ({ select(value) { calls.push(['select', value]); return this; }, sort(value) { calls.push(['sort', value]); return this; }, limit(value) { calls.push(['limit', value]); return this; }, maxTimeMS(value) { calls.push(['timeout', value]); return this; }, lean() { return this; }, async exec() { return result; } });
  const dao = load('models/OrderDAO.js', { '../utils/MongooseUtil': {}, mongoose: { Types: { ObjectId: class { constructor(value) { this.value = value; } } } }, './Models': { Order: {
    find(filter) { calls.push(['find', filter]); return chain([]); },
    findOne(filter) { calls.push(['one', filter]); return chain({ _id: id, cdate: 100 }); },
    countDocuments(filter) { calls.push(['count', filter]); return chain(7); }
  } } });
  for (const input of [null, [], { $where: 'attack' }, { customerId: owner }, { orderId: { $ne: null } }, { latest: 'true' }, { statuses: ['shipping'] }, { statuses: { $ne: null } }, { limit: 999 }, { limit: 0 }, { from: 'yesterday' }, { from: 5, to: 4 }, { beforeOrderId: 'ABC123' }]) {
    await assert.rejects(dao.lookupForAssistant(owner, input), { code: 'INVALID_ORDER_LOOKUP' });
  }
  assert.equal(calls.length, 0);
  const result = await dao.lookupForAssistant(owner, { statuses: ['pending', 'preparing'], count: true });
  assert.equal(result.total, 7);
  assert.equal(calls.find(([op]) => op === 'find')[1]['customer._id'].value, owner);
  assert.equal(calls.find(([op]) => op === 'count')[1]['customer._id'].value, owner);
  assert.deepEqual(calls.find(([op]) => op === 'sort')[1], { cdate: -1, _id: -1 });
  assert.equal(calls.find(([op]) => op === 'limit')[1], 5);
  calls.length = 0;
  await dao.lookupForAssistant(owner, { latest: true, beforeOrderId: id });
  assert.equal(calls.find(([op]) => op === 'one')[1]['customer._id'].value, owner);
  assert.equal(calls.find(([op]) => op === 'find')[1].$or[0].cdate.$lt, 100);
  assert.equal(calls.find(([op]) => op === 'limit')[1], 1);
});

test('order service latest, fresh followups, previous, yesterday, ambiguous references and privacy', async () => {
  let row = { _id: id, status: 'pending', cdate: 0, total: 850000, paymentStatus: 'unpaid', customerInfo: { paymentMethod: 'cod', address: 'PRIVATE' }, customer: { password: 'PRIVATE' } };
  const calls = [];
  const service = load('services/ai/OrderStatusService.js', {
    '../../utils/PaymentPolicy': require('../utils/PaymentPolicy'),
    './HandoffService': require('../services/ai/HandoffService'),
    '../../models/CustomerDAO': { async selectByID() { return { active: 1 }; } },
    '../../models/OrderDAO': { async lookupForAssistant(customer, input) { assert.equal(customer, owner); calls.push(input); return { orders: row ? [row] : [], total: input.count ? 1 : null }; } }
  });
  const actor = { sub: owner, role: 'customer' }, context = {};
  const first = await service.getOrderStatus(actor, 'Đơn gần nhất tổng bao nhiêu?', context);
  assert.equal(first.body.order.total, 850000); assert.deepEqual(calls[0], { latest: true });
  assert.equal(context.lastOrderId, id); assert.deepEqual(Object.keys(context), ['lastOrderId']);
  row = { ...row, status: 'delivering', total: 900000, paymentStatus: 'paid' };
  const next = await service.getOrderStatus(actor, 'Đơn đó thanh toán chưa?', context);
  assert.deepEqual(calls[1], { orderId: id }); assert.equal(next.body.order.paymentStatus, 'paid');
  assert.equal(next.body.order.status, 'Đang giao'); assert.equal(next.body.order.total, 900000);
  assert.ok(!JSON.stringify(next).includes('PRIVATE'));
  await service.getOrderStatus(actor, 'Còn đơn trước đó?', context);
  assert.deepEqual(calls[2], { beforeOrderId: id, latest: true });
  assert.ok(service.parseOrderLookup('Đơn đó sao rồi?', {}).clarification);
  assert.ok(service.parseOrderLookup('Kiểm tra đơn #ABC123').clarification);
  assert.ok(service.parseOrderLookup('Kiểm tra đơn $where').clarification);
  const date = service.parseOrderLookup('Tôi đặt hoa hôm qua, kiểm tra giúp tôi');
  assert.equal(date.to - date.from, 86400000);
  assert.deepEqual(service.parseOrderLookup('Tôi có bao nhiêu đơn đang xử lý?').statuses, ['pending', 'approved', 'preparing', 'delivering']);
  row = null;
  assert.equal((await service.getOrderStatus(actor, `Đơn ${id}`, context)).body.order, null);
});
