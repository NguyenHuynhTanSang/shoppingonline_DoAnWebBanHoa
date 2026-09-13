const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, http } = require('./helpers/order-store');
const delivery = require('../utils/DeliveryValidation');
const pid = '1'.repeat(24), second = '2'.repeat(24);
function fixture() {
  const s = setup();
  s.state.products[pid] = { _id: pid, name: 'Flower', price: 500000, stock: 10, sold: 0 };
  s.state.vouchers.v = { _id: 'v', code: 'TEST', isActive: true, type: 'fixed', value: 50000, usageLimit: 10, usedCount: 0 };
  return s;
}
const body = () => ({ deliveryDate: delivery.vietnamToday(), deliveryTimeSlot: '08:00-12:00', items: [{ _id: pid, quantity: 1 }], voucherCode: ' test ' });
const post = (api, changes = {}) => api.request('customer/checkout', 'POST', { ...body(), ...changes });

test('last voucher slot (1/0 and 10/9) and combined stock race admit only one checkout', async () => {
  for (const [limit, count, stock] of [[1, 0, 10], [10, 9, 10], [1, 0, 1]]) {
    const s = fixture(); Object.assign(s.state.vouchers.v, { usageLimit: limit, usedCount: count });
    s.state.products[pid].stock = stock;
    const api = await http(s);
    let arrivals = 0, release;
    const barrier = new Promise(resolve => { release = resolve; });
    s.faults.beforeCommit = async () => { if (++arrivals === 2) release(); await barrier; };
    try {
      const results = await Promise.all([post(api), post(api)]);
      assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
      const code = results.find(result => result.status === 409).body.code;
      if (stock === 1) assert.ok(['INSUFFICIENT_STOCK', 'VOUCHER_USAGE_CONFLICT'].includes(code));
      else assert.equal(code, 'VOUCHER_USAGE_CONFLICT');
      assert.equal(s.state.vouchers.v.usedCount, limit);
      assert.equal(s.state.products[pid].stock, stock - 1);
      assert.equal(Object.keys(s.state.orders).length, 1);
      assert.ok(s.stats().retries > 0);
      const filter = s.writes.find(write => write.collection === 'vouchers').filter;
      assert.equal((filter.$or?.[0] || filter).usedCount.$lt, limit);
    } finally { await api.close(); }
  }
});

test('stock, voucher conflict/write, insert and commit failures rollback the whole checkout', async t => {
  t.mock.method(console, 'error', () => {});
  for (const fault of ['stock', 'second-stock', 'voucherMiss', 'vouchers', 'create', 'commit', 'unsupported']) {
    const s = fixture();
    if (fault === 'stock') s.state.products[pid].stock = 0;
    else if (fault === 'second-stock') s.state.products[second] = { _id: second, price: 1, stock: 0, sold: 0 };
    else s.faults[fault] = true;
    const before = JSON.stringify(s.state); const api = await http(s);
    try {
      const response = await post(api, fault === 'second-stock' ? { items: [{ _id: pid, quantity: 1 }, { _id: second, quantity: 1 }] } : {});
      assert.equal(response.status, ['stock', 'second-stock', 'voucherMiss'].includes(fault) ? 409 : 503, fault);
      assert.equal(JSON.stringify(s.state), before);
      if (fault === 'create') assert.ok(s.writes.some(write => write.collection === 'vouchers' && write.update.$inc.usedCount === 1));
      assert.ok(!JSON.stringify(response.body).includes('synthetic'));
    } finally { await api.close(); }
  }
});

test('voucher invalidated between attempts fails explicitly, never commits full price', async () => {
  const s = fixture(); const api = await http(s); let changed = false;
  s.faults.beforeCommit = async () => {
    if (changed) return;
    changed = true;
    await s.lifecycle.transaction(session => s.models.Voucher.findOneAndUpdate({ _id: 'v' }, { $set: { isActive: false } }, { session }).exec());
  };
  try {
    const response = await post(api);
    assert.equal(response.status, 409); assert.equal(response.body.code, 'VOUCHER_USAGE_CONFLICT');
    assert.equal(Object.keys(s.state.orders).length, 0);
    assert.equal(s.state.products[pid].stock, 10); assert.equal(s.state.vouchers.v.usedCount, 0);
  } finally { await api.close(); }
});

test('server amounts: fixed, percent, maxDiscount, subtotal cap, product discount and shipping threshold', async () => {
  const cases = [
    { price: 500000, voucher: {}, discount: 50000, shipping: 30000 },
    { price: 500000, voucher: { type: 'percent', value: 20 }, discount: 100000, shipping: 30000 },
    { price: 500000, voucher: { type: 'percent', value: 20, maxDiscount: 60000 }, discount: 60000, shipping: 30000 },
    { price: 500000, voucher: { value: 900000 }, discount: 500000, shipping: 30000 },
    { price: 1500000, voucher: { value: 2000000 }, discount: 1500000, shipping: 0 },
    { price: 1499999, voucher: {}, discount: 50000, shipping: 30000 },
    { price: 500000, percent: 10, subtotal: 450000, voucher: {}, discount: 50000, shipping: 30000 }
  ];
  for (const c of cases) {
    const s = fixture(); Object.assign(s.state.products[pid], { price: c.price, discountPercent: c.percent || 0 });
    Object.assign(s.state.vouchers.v, c.voucher);
    const api = await http(s);
    try {
      const response = await post(api, { price: 1, subtotal: 1, discount: 999999999, shippingFee: 0, total: -1,
        status: 'completed', paymentStatus: 'REFUNDED', stockReserved: false,
        items: [{ _id: pid, quantity: 1, price: 1, product: { price: 1 } }] });
      assert.equal(response.status, 200);
      const subtotal = c.subtotal || c.price;
      const expected = { subtotal, discount: c.discount, shippingFee: c.shipping, total: Math.max(subtotal - c.discount + c.shipping, 0) };
      assert.deepEqual(response.body.pricing, expected);
      const saved = Object.values(s.state.orders)[0];
      for (const [key, value] of Object.entries(expected)) assert.equal(saved[key], value);
      assert.equal(saved.items[0].product.price, subtotal);
      assert.equal(saved.status, 'pending'); assert.equal(saved.stockReserved, true);
      assert.notEqual(saved.paymentStatus, 'REFUNDED'); assert.equal(saved.voucherCode, 'TEST');
    } finally { await api.close(); }
  }
});

test('malformed quantities and non-finite calculated amounts never persist', async () => {
  const s = fixture(); const api = await http(s); const before = JSON.stringify(s.state);
  try {
    for (const quantity of [0, -1, 1.5, NaN, Infinity, -Infinity, null, 'NaN', 'Infinity', '2', true, {}, []]) {
      const result = await post(api, { items: [{ _id: pid, quantity }] });
      assert.equal(result.status, 400); assert.equal(result.body.code, 'INVALID_QUANTITY');
      assert.equal(JSON.stringify(s.state), before);
    }
    s.state.products[pid].price = 1e308;
    const hugeBefore = JSON.stringify(s.state);
    const overflow = await post(api, { items: [{ _id: pid, quantity: 2 }] });
    assert.equal(overflow.status, 400); assert.equal(overflow.body.code, 'INVALID_AMOUNTS');
    assert.equal(JSON.stringify(s.state), hugeBefore);
  } finally { await api.close(); }
});

test('voucher invalid/expired/minimum and exhausted data return distinct safe failures', async () => {
  for (const patch of [null, { isActive: false }, { startDate: Date.now() + 60000 }, { endDate: 1 },
    { minOrderValue: 500001 }, { type: 'unknown' }, { value: -1 }, { value: 0 },
    { usageLimit: 1, usedCount: 1 }, { usedCount: -1 }, { usedCount: 0.5 }]) {
    const s = fixture();
    if (patch === null) delete s.state.vouchers.v; else Object.assign(s.state.vouchers.v, patch);
    const before = JSON.stringify(s.state); const api = await http(s);
    try {
      const response = await post(api);
      assert.equal(response.status, patch && 'usedCount' in patch ? 409 : 400);
      assert.equal(JSON.stringify(s.state), before);
    } finally { await api.close(); }
  }
});

test('unlimited 0/null/missing, missing counter defaults, no-voucher and cancel release remain compatible', async () => {
  for (const limit of [0, null, undefined]) {
    const s = fixture(); if (limit === undefined) delete s.state.vouchers.v.usageLimit; else s.state.vouchers.v.usageLimit = limit;
    delete s.state.vouchers.v.usedCount;
    const api = await http(s);
    try {
      const response = await post(api); assert.equal(response.status, 200);
      assert.equal(s.state.vouchers.v.usedCount, 1);
      for (let i = 0; i < 2; i++) assert.equal((await api.request(`customer/orders/${response.body.order._id}/cancel`, 'PUT', {})).status, 200);
      assert.equal(s.state.vouchers.v.usedCount, 0); assert.equal(s.state.products[pid].stock, 10);
      const writes = s.writes.filter(write => write.collection === 'vouchers').length;
      assert.equal((await post(api, { voucherCode: '' })).status, 200);
      assert.equal(s.writes.filter(write => write.collection === 'vouchers').length, writes);
    } finally { await api.close(); }
  }
});
