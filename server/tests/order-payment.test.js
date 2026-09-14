const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, http } = require('./helpers/order-store');
const policy = require('../utils/PaymentPolicy');
const { PAYMENT_STATUS: P } = policy;
const pid = '1'.repeat(24), oid = '3'.repeat(24), owner = '4'.repeat(24);
function fixture(method = 'cod', status = 'delivering') {
  const s = setup();
  s.state.products[pid] = { _id: pid, price: 500000, stock: 3, sold: 0 };
  s.state.orders[oid] = { _id: oid, status, stockReserved: true, customer: { _id: owner },
    customerInfo: { paymentMethod: method }, paymentStatus: policy.checkoutStatus(method),
    items: [{ product: { _id: pid }, quantity: 2 }] };
  return s;
}
test('checkout payment tampering is ignored; allowlist/defaults preserved with no invalid writes', async () => {
  const s = setup(); s.state.products[pid] = { _id: pid, price: 500000, stock: 10, sold: 0 };
  const api = await http(s);
  const base = { deliveryDate: require('../utils/DeliveryValidation').vietnamToday(), deliveryTimeSlot: '08:00-12:00', items: [{ _id: pid, quantity: 1 }], paymentStatus: 'paid' };
  try {
    for (const method of ['cod', 'bank', 'momo', undefined]) {
      const result = await api.request('customer/checkout', 'POST', { ...base, customerInfo: { paymentMethod: method, paymentStatus: 'paid' } });
      assert.equal(result.status, 200);
      assert.equal(result.body.order.paymentStatus, policy.checkoutStatus(method || 'cod'));
      assert.equal(s.state.orders[result.body.order._id].paymentStatus, result.body.order.paymentStatus);
      assert.equal(result.body.order.status, 'pending');
    }
    const before = JSON.stringify(s.state);
    for (const method of ['cash2', 'paypal', 'abc', '', 'COD', {}, 1]) {
      assert.equal((await api.request('customer/checkout', 'POST', { ...base, customerInfo: { paymentMethod: method } })).status, 400);
      assert.equal(JSON.stringify(s.state), before);
    }
  } finally { await api.close(); }
});
for (const method of ['cod', 'bank', 'momo']) {
  test(`${method}: completion/payment write is atomic and duplicate completion does nothing`, async () => {
    const s = fixture(method);
    const results = await Promise.all([s.lifecycle.transition(oid, 'completed', 'admin'), s.lifecycle.transition(oid, 'completed', 'admin')]);
    assert.equal(results.filter(result => !result.unchanged).length, 1);
    assert.equal(s.state.orders[oid].paymentStatus, method === 'cod' ? P.PAID : P.DEMO_UNVERIFIED);
    assert.equal(s.state.orders[oid].status, 'completed');
    assert.equal(s.state.products[pid].stock, 3); assert.equal(s.state.products[pid].sold, 2);
    const writes = s.writes.length;
    await s.lifecycle.transition(oid, 'completed', 'admin'); assert.equal(s.writes.length, writes);
    const change = s.writes.find(write => write.collection === 'orders');
    assert.deepEqual(change.update.$set, { status: 'completed', paymentStatus: method === 'cod' ? P.PAID : P.DEMO_UNVERIFIED });
  });
  test(`${method}: cancel leaves payment unchanged, no refund`, async () => {
    const s = fixture(method, 'pending');
    await s.lifecycle.transition(oid, 'canceled', 'customer', owner);
    assert.equal(s.state.orders[oid].paymentStatus, policy.checkoutStatus(method));
    assert.equal(s.state.orders[oid].status, 'canceled'); assert.equal(s.state.products[pid].stock, 5);
  });
}
test('COD completion failures rollback both status and payment, along with inventory', async () => {
  for (const fault of ['orders', 'products', 'stale', 'commit', 'unsupported']) {
    const s = fixture(); s.faults[fault] = true;
    const before = JSON.stringify(s.state);
    await assert.rejects(() => s.lifecycle.transition(oid, 'completed', 'admin'));
    assert.equal(JSON.stringify(s.state), before);
  }
});
test('legacy presentation is truthful without migration; missing method is not inferred as COD', async () => {
  const s = fixture('bank'); s.state.orders[oid].paymentStatus = 'Đã thanh toán demo';
  assert.equal(policy.displayStatus(s.state.orders[oid].paymentStatus), 'Thanh toán demo - chưa xác minh (dữ liệu cũ)');
  assert.equal(s.state.orders[oid].paymentStatus, 'Đã thanh toán demo');
  await s.lifecycle.transition(oid, 'completed', 'admin');
  assert.equal(s.state.orders[oid].paymentStatus, 'Đã thanh toán demo');
  const unknown = fixture(); delete unknown.state.orders[oid].customerInfo;
  await unknown.lifecycle.transition(oid, 'completed', 'admin');
  assert.equal(unknown.state.orders[oid].paymentStatus, P.COD_PENDING);
});
