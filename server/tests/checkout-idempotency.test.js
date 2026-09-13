const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, http } = require('./helpers/order-store');
const Models = require('../models/Models');
const pid = '1'.repeat(24), other = '2'.repeat(24), owner = '4'.repeat(24);
const key = 'checkout-test-key-0001';
function body() {
  return { deliveryDate: '2099-01-01', deliveryTimeSlot: '08:00-12:00', cardMessage: 'Hello',
    items: [{ _id: pid, quantity: 1 }], voucherCode: 'TEST', customerInfo: { address: 'A', paymentMethod: 'cod' } };
}
async function fixture(run) {
  const s = setup();
  for (const id of [pid, other]) s.state.products[id] = { _id: id, price: 500000, stock: 10, sold: 0 };
  s.state.vouchers.v = { _id: 'v', code: 'TEST', type: 'fixed', value: 10000, isActive: true, usedCount: 0, usageLimit: 10 };
  const api = await http(s);
  const post = (value = body(), k = key, customer = owner) => api.request('customer/checkout', 'POST', value, 'customer', customer, k);
  try { await run(s, post); } finally { await api.close(); }
}
test('required key and strict index readiness fail closed, including removal after successful verification', async () => {
  await fixture(async (s, post) => {
    for (const k of [null, '', ' ', 'short', 'x'.repeat(129), 'bad/key-value-0000']) {
      const r = await post(body(), k);
      assert.equal(r.status, 400); assert.equal(s.writes.length, 0);
      if (k === null) assert.equal(r.body.code, 'IDEMPOTENCY_KEY_REQUIRED');
    }
    const correct = { name: 'checkout_customer_key_unique', key: { 'customer._id': 1, checkoutIdempotencyKey: 1 }, unique: true,
      partialFilterExpression: { checkoutIdempotencyKey: { $type: 'string' } } };
    for (const indexes of [[], [{ ...correct, unique: false }], [{ ...correct, key: { checkoutIdempotencyKey: 1 } }],
      [{ ...correct, partialFilterExpression: { checkoutIdempotencyKey: { $exists: true } } }], [{ ...correct, name: 'wrong' }]]) {
      s.faults.indexes = indexes;
      const r = await post(); assert.equal(r.status, 503); assert.equal(r.body.code, 'CHECKOUT_IDEMPOTENCY_NOT_READY');
      assert.equal(s.writes.length, 0); assert.equal(Object.keys(s.state.orders).length, 0);
    }
    s.faults.indexes = [correct]; assert.equal((await post()).status, 200);
    const before = JSON.stringify(s.state); s.faults.indexes = [];
    assert.equal((await post()).status, 503); assert.equal(JSON.stringify(s.state), before);
  });
});
test('sequential replay ignores client money/status and normalized ordering/case; returns no internal fingerprint', async () => {
  await fixture(async (s, post) => {
    const payload = body(); payload.items.push({ _id: other, quantity: 1 });
    const first = await post(payload); assert.equal(first.status, 200);
    const before = JSON.stringify(s.state), writes = s.writes.length;
    const retry = await post({ ...payload, items: [...payload.items].reverse(), voucherCode: ' test ', total: 1, paymentStatus: 'paid', customerId: 'foreign' });
    assert.equal(retry.status, 200); assert.equal(retry.body.order._id, first.body.order._id);
    assert.equal(JSON.stringify(s.state), before); assert.equal(s.writes.length, writes);
    assert.equal(retry.body.order.checkoutIntentHash, undefined); assert.equal(retry.body.order.checkoutIdempotencyKey, undefined);
  });
});
test('concurrent unique-key race: stock final unit and voucher final slot consumed once, both return winner', async () => {
  await fixture(async (s, post) => {
    s.state.products[pid].stock = 1; s.state.vouchers.v.usageLimit = 1;
    let count = 0, release;
    const barrier = new Promise(resolve => { release = resolve; });
    s.faults.beforeCommit = async () => { if (++count === 2) release(); await barrier; };
    const results = await Promise.all([post(), post()]);
    assert.deepEqual(results.map(r => r.status), [200, 200]);
    assert.equal(results[0].body.order._id, results[1].body.order._id);
    assert.equal(Object.keys(s.state.orders).length, 1); assert.equal(s.state.products[pid].stock, 0);
    assert.equal(s.state.vouchers.v.usedCount, 1);
  });
});
test('commit acknowledgement lost replays original; aborted transaction leaves key reusable', async () => {
  await fixture(async (s, post) => {
    s.faults.commit = true; assert.equal((await post()).status, 503);
    assert.equal(Object.keys(s.state.orders).length, 0); assert.equal(s.state.products[pid].stock, 10);
    s.faults.commit = false; s.faults.commitResponseLost = true;
    const first = await post(); assert.equal(first.status, 200);
    const before = JSON.stringify(s.state);
    const retry = await post(); assert.equal(retry.body.order._id, first.body.order._id);
    assert.equal(JSON.stringify(s.state), before);
  });
});
test('committed key rejects changed business intent without mutation', async () => {
  await fixture(async (s, post) => {
    assert.equal((await post()).status, 200); const before = JSON.stringify(s.state);
    for (const patch of [{ items: [{ _id: other, quantity: 1 }] }, { items: [{ _id: pid, quantity: 2 }] },
      { voucherCode: 'OTHER' }, { cardMessage: 'Changed' }, { deliveryDate: '2099-01-02' },
      { deliveryTimeSlot: '12:00-17:00' }, { customerInfo: { address: 'B', paymentMethod: 'cod' } },
      { customerInfo: { address: 'A', paymentMethod: 'momo' } }]) {
      const r = await post({ ...body(), ...patch });
      assert.equal(r.status, 409); assert.equal(r.body.code, 'IDEMPOTENCY_KEY_REUSE_CONFLICT');
      assert.equal(JSON.stringify(s.state), before);
    }
  });
});
test('customer scope is independent even when body spoofs customer identity', async () => {
  await fixture(async (s, post) => {
    const a = await post(); const b = await post({ ...body(), customerId: owner }, key, '5'.repeat(24));
    assert.equal(b.status, 200); assert.notEqual(a.body.order._id, b.body.order._id);
    assert.equal(b.body.order.customer._id, '5'.repeat(24)); assert.equal(Object.keys(s.state.orders).length, 2);
  });
});
test('concurrent different intents under one key have one winner and a safe conflict', async () => {
  await fixture(async (s, post) => {
    let count = 0, release;
    const barrier = new Promise(resolve => { release = resolve; });
    s.faults.beforeCommit = async () => { if (++count === 2) release(); await barrier; };
    const results = await Promise.all([post(), post({ ...body(), items: [{ _id: other, quantity: 1 }] })]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    assert.equal(results.find(r => r.status === 409).body.code, 'IDEMPOTENCY_KEY_REUSE_CONFLICT');
    assert.equal(Object.keys(s.state.orders).length, 1); assert.equal(s.state.vouchers.v.usedCount, 1);
    assert.equal(s.state.products[pid].stock + s.state.products[other].stock, 19);
  });
});
test('metadata read failure fails closed, and committed demo replay never revalidates voucher/product', async () => {
  await fixture(async (s, post) => {
    s.faults.indexError = true; assert.equal((await post()).status, 503); assert.equal(s.writes.length, 0);
    s.faults.indexError = false;
    const payload = { ...body(), customerInfo: { paymentMethod: 'momo' } };
    const first = await post(payload); assert.equal(first.status, 200);
    delete s.state.products[pid]; s.state.vouchers.v.isActive = false;
    const before = JSON.stringify(s.state);
    const replay = await post(payload);
    assert.equal(replay.status, 200); assert.equal(replay.body.order._id, first.body.order._id);
    assert.equal(replay.body.order.paymentStatus, 'Thanh toán demo - chưa xác minh');
    assert.equal(JSON.stringify(s.state), before);
  });
});
for (const status of ['canceled', 'completed']) test(`${status} original replays current state without checkout effects`, async () => {
  await fixture(async (s, post) => {
    const first = await post(); const id = first.body.order._id;
    if (status === 'completed') {
      for (const next of ['approved', 'preparing', 'delivering']) await s.lifecycle.transition(id, next, 'admin');
    }
    await s.lifecycle.transition(id, status, 'admin');
    const before = JSON.stringify(s.state), writes = s.writes.length;
    const replay = await post(); assert.equal(replay.body.order._id, id); assert.equal(replay.body.order.status, status);
    if (status === 'completed') assert.equal(replay.body.order.paymentStatus, 'Đã thanh toán');
    assert.equal(JSON.stringify(s.state), before); assert.equal(s.writes.length, writes);
  });
});
test('insufficient stock and invalid input do not persist a ghost key', async () => {
  await fixture(async (s, post) => {
    s.state.products[pid].stock = 0; assert.equal((await post()).status, 409);
    assert.equal(Object.keys(s.state.orders).length, 0); assert.equal(s.state.vouchers.v.usedCount, 0);
    assert.equal((await post({ ...body(), deliveryTimeSlot: 'bad' })).status, 400);
    s.state.products[pid].stock = 1; assert.equal((await post()).status, 200);
  });
});
test('schema declares deployment-managed partial unique index and accepts legacy orders', async () => {
  assert.equal(Models.Order.schema.options.autoIndex, false);
  const [pattern, options] = Models.Order.schema.indexes().find(([, o]) => o.name === 'checkout_customer_key_unique');
  assert.deepEqual(pattern, { 'customer._id': 1, checkoutIdempotencyKey: 1 });
  assert.equal(options.unique, true); assert.deepEqual(options.partialFilterExpression, { checkoutIdempotencyKey: { $type: 'string' } });
  const old = new Models.Order({ status: 'pending' }); await old.validate();
  assert.equal(old.checkoutIdempotencyKey, undefined);
});
