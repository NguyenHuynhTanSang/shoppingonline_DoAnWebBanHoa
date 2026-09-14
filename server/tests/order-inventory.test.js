const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers/order-store');
const productId = '1'.repeat(24), secondId = '2'.repeat(24), orderId = '3'.repeat(24), owner = '4'.repeat(24);
const item = (id = productId, quantity = 1) => ({ product: { _id: id, price: 100 }, quantity });
function fixture(status = 'pending', stockReserved = true) {
  const store = setup();
  store.state.products[productId] = { _id: productId, stock: 1, sold: 0 };
  store.state.orders[orderId] = { _id: orderId, status, ...(stockReserved === undefined ? {} : { stockReserved }), customer: { _id: owner }, items: [item()] };
  return store;
}
test('stock=1: competing checkouts, canonical conditional update, one committed order', async () => {
  const s = setup(); s.state.products[productId] = { _id: productId, stock: 1, sold: 0 };
  const checkout = () => s.lifecycle.transaction(session => s.lifecycle.reserveAndCreate({ items: [item()] }, session));
  const results = await Promise.allSettled([checkout(), checkout()]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.code, 'INSUFFICIENT_STOCK');
  assert.equal(s.state.products[productId].stock, 0);
  const orders = Object.values(s.state.orders);
  assert.equal(orders.length, 1); assert.equal(orders[0].status, 'pending'); assert.equal(orders[0].stockReserved, true);
  assert.ok(s.stats().retries > 0);
  assert.deepEqual(s.writes[0].filter, { _id: productId, stock: { $gte: 1 } });
  assert.equal(s.writes[0].update.$inc.stock, -1);
});
test('new checkout through the full lifecycle completes with zero available stock', async () => {
  const s = setup(); s.state.products[productId] = { _id: productId, stock: 1, sold: 0 };
  const order = await s.lifecycle.transaction(session => s.lifecycle.reserveAndCreate({ items: [item()], customer: { _id: owner } }, session));
  for (const status of ['approved', 'preparing', 'delivering', 'completed', 'completed']) {
    await s.lifecycle.transition(String(order._id), status, 'admin');
    assert.equal(s.state.products[productId].stock, 0);
    assert.equal(s.state.products[productId].sold, status === 'completed' ? 1 : 0);
  }
});
test('multi-product shortage, duplicate lines, insert failure and retry roll back reservations', async () => {
  for (const mode of ['shortage', 'insert', 'duplicate', 'retry']) {
    const s = setup();
    s.state.products[productId] = { _id: productId, stock: 2, sold: 0 };
    s.state.products[secondId] = { _id: secondId, stock: mode === 'shortage' ? 0 : 1, sold: 0 };
    s.faults.create = mode === 'insert'; s.faults.retryOnce = mode === 'retry';
    const items = mode === 'duplicate' ? [item(productId, 2), item()] : [item(), item(secondId)];
    const run = () => s.lifecycle.transaction(session => s.lifecycle.reserveAndCreate({ items }, session));
    if (mode === 'retry') {
      await run(); assert.equal(s.state.products[productId].stock, 1); assert.equal(Object.keys(s.state.orders).length, 1);
    } else {
      await assert.rejects(run); assert.equal(s.state.products[productId].stock, 2); assert.equal(Object.keys(s.state.orders).length, 0);
    }
  }
});
for (const reserved of [true, false, 'missing']) {
  test(`${reserved}: concurrent/duplicate completion deducts only legacy and counts sold once`, async () => {
    const s = fixture('delivering', reserved === 'missing' ? false : reserved);
    if (reserved === 'missing') delete s.state.orders[orderId].stockReserved;
    const run = () => s.lifecycle.transition(orderId, 'completed', 'admin');
    await Promise.all([run(), run()]); await run();
    assert.equal(s.state.products[productId].stock, reserved === true ? 1 : 0);
    assert.equal(s.state.products[productId].sold, 1); assert.equal(s.state.orders[orderId].status, 'completed');
  });
  test(`${reserved}: cancel releases only reserved inventory once, including concurrency`, async () => {
    for (const [status, actor] of [['pending', 'customer'], ['approved', 'admin']]) {
      const s = fixture(status, reserved === 'missing' ? false : reserved);
      if (reserved === 'missing') delete s.state.orders[orderId].stockReserved;
      const run = () => s.lifecycle.transition(orderId, 'canceled', actor, owner);
      await Promise.all([run(), run()]); await run();
      assert.equal(s.state.products[productId].stock, reserved === true ? 2 : 1);
      assert.equal(s.state.products[productId].sold, 0); assert.equal(s.state.orders[orderId].status, 'canceled');
    }
  });
}
test('legacy shortage, sold/release failure, voucher failure and stale status roll back', async () => {
  for (const fault of ['shortage', 'products', 'vouchers', 'stale']) {
    const s = fixture(fault === 'shortage' ? 'delivering' : 'pending', fault !== 'shortage');
    if (fault === 'shortage') {
      s.state.orders[orderId].items.push(item(secondId));
      s.state.products[secondId] = { _id: secondId, stock: 0, sold: 0 };
    } else s.faults[fault] = true;
    s.state.orders[orderId].voucherCode = 'TEST';
    s.state.vouchers.v = { _id: 'v', code: 'TEST', usedCount: 1 };
    const before = JSON.stringify(s.state);
    await assert.rejects(() => s.lifecycle.transition(orderId, fault === 'shortage' ? 'completed' : 'canceled', 'admin'));
    assert.equal(JSON.stringify(s.state), before);
  }
});
test('complete vs cancel, ownership and terminal guards run before inventory writes', async () => {
  const s = fixture('delivering');
  const result = await Promise.allSettled([
    s.lifecycle.transition(orderId, 'completed', 'admin'), s.lifecycle.transition(orderId, 'canceled', 'staff')
  ]);
  assert.equal(result[0].status, 'fulfilled'); assert.equal(result[1].status, 'rejected');
  assert.equal(s.state.products[productId].stock, 1); assert.equal(s.state.products[productId].sold, 1);
  await assert.rejects(() => s.lifecycle.transition(orderId, 'canceled', 'admin'), { code: 'INVALID_TRANSITION' });
  await assert.rejects(() => s.lifecycle.transition(orderId, 'completed', 'customer', '5'.repeat(24)), { code: 'FORBIDDEN' });
  assert.ok(s.writes.some(write => write.collection === 'orders' && write.filter.status === 'delivering'));
});
test('unsupported transactions fail safely; inventory methods require a transaction', async () => {
  const s = fixture(); s.faults.unsupported = true;
  const before = JSON.stringify(s.state);
  await assert.rejects(() => s.lifecycle.transition(orderId, 'canceled', 'admin'));
  assert.equal(JSON.stringify(s.state), before); assert.equal(s.stats().ended, 1);
  await assert.rejects(() => s.productDAO.reserveStock(productId, 1));
});

test('second sold write failure rolls back the first increment and legacy deduction', async () => {
  for (const reserved of [true, false]) {
    const s = fixture('delivering', reserved);
    s.state.products[secondId] = { _id: secondId, stock: 1, sold: 0 };
    s.state.orders[orderId].items.push(item(secondId));
    s.faults.soldId = secondId;
    const before = JSON.stringify(s.state);
    await assert.rejects(() => s.lifecycle.transition(orderId, 'completed', 'admin'));
    assert.equal(JSON.stringify(s.state), before);
  }
});

test('direct checkout HTTP: shortage, unsupported transaction and failed order insert are safe', async t => {
  const { http } = require('./helpers/order-store');
  const s = setup();
  const api = await http(s);
  const delivery = require('../utils/DeliveryValidation');
  const body = { deliveryDate: delivery.vietnamToday(), deliveryTimeSlot: '08:00-12:00', items: [{ _id: productId, quantity: 1 }] };
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  try {
    s.state.products[productId] = { _id: productId, price: 100, stock: 0, sold: 0 };
    const short = await api.request('customer/checkout', 'POST', body);
    assert.equal(short.status, 409); assert.equal(short.body.code, 'INSUFFICIENT_STOCK');
    s.state.products[productId].stock = 1;
    for (const fault of ['unsupported', 'create']) {
      s.faults[fault] = true;
      const response = await api.request('customer/checkout', 'POST', body);
      assert.equal(response.status, 503); assert.equal(response.body.code, 'ORDER_TRANSACTION_FAILED');
      assert.ok(!JSON.stringify(response.body).includes('synthetic'));
      assert.equal(s.state.products[productId].stock, 1); assert.equal(Object.keys(s.state.orders).length, 0);
      s.faults[fault] = false;
    }
    assert.deepEqual(logs, [['Order transaction failed'], ['Order transaction failed']]);
    const results = await Promise.all([api.request('customer/checkout', 'POST', body), api.request('customer/checkout', 'POST', body)]);
    assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
    assert.equal(s.state.products[productId].stock, 0); assert.equal(Object.keys(s.state.orders).length, 1);
  } finally { await api.close(); }
});
