const test = require('node:test');
const assert = require('node:assert/strict');
const delivery = require('../utils/DeliveryValidation');
const Models = require('../models/Models');
const base = { deliveryDate: '2026-09-10', deliveryTimeSlot: '08:00-12:00', cardMessage: ' Chúc mừng! ' };
const now = new Date('2026-09-09T17:00:00Z');

test('calendar date, Vietnam midnight, whitelist, optional message and wrong types', () => {
  assert.equal(delivery.vietnamToday(now), '2026-09-10');
  assert.deepEqual(delivery.validateDelivery(base, now).value, { ...base, cardMessage: 'Chúc mừng!' });
  assert.equal(delivery.validateDelivery({ ...base, cardMessage: undefined }, now).value.cardMessage, '');
  for (const changes of [
    { deliveryDate: '2026-09-09' }, { deliveryDate: '2026-02-30' }, { deliveryDate: 'bad' },
    { deliveryDate: 123 }, { deliveryDate: null }, { deliveryDate: undefined },
    { deliveryTimeSlot: 'midnight' }, { deliveryTimeSlot: {} }, { deliveryTimeSlot: undefined },
    { cardMessage: null }, { cardMessage: {} }, { cardMessage: 123 }, { cardMessage: 'a'.repeat(301) }
  ]) assert.ok(delivery.validateDelivery({ ...base, ...changes }, now).message, JSON.stringify(changes));
  assert.equal(delivery.validateDelivery({ ...base, cardMessage: 'a'.repeat(300) }, now).value.cardMessage.length, 300);
  assert.equal(delivery.isCalendarDate('2028-02-29'), true);
  assert.equal(delivery.isCalendarDate('2027-02-29'), false);
});

test('Mongoose retains date string and card text, permits old orders and validates schema', async () => {
  const message = '<script>alert(1)</script>';
  const order = new Models.Order({ ...base, cardMessage: message });
  await order.validate();
  assert.equal(order.toObject().deliveryDate, '2026-09-10');
  assert.equal(order.toObject().cardMessage, message);
  await new Models.Order({ status: 'pending' }).validate();
  assert.equal(new Models.Order({ status: 'pending' }).stockReserved, false);
  assert.equal(new Models.Order({ stockReserved: true }).toObject().stockReserved, true);
  for (const patch of [{ deliveryDate: '2026-02-30' }, { deliveryTimeSlot: 'invalid' }, { cardMessage: 'x'.repeat(301) }]) {
    await assert.rejects(new Models.Order({ ...base, ...patch }).validate());
  }
});

test('checkout HTTP -> real lifecycle/DAO with simulated transactions; COD/voucher and input tampering', async () => {
  const { setup, http } = require('./helpers/order-store');
  const store = setup();
  const owner = '4'.repeat(24);
  store.state.products['222222222222222222222222'] = { _id: '222222222222222222222222', name: 'Hoa', price: 500000, stock: 30, sold: 0 };
  store.state.vouchers.v = { _id: 'v', code: 'TEST', type: 'fixed', value: 50000, isActive: true, usedCount: 0 };
  const api = await http(store);
  const saved = [];
  const tomorrow = delivery.vietnamToday(new Date(Date.now() + 86400000));
  const valid = { ...base, deliveryDate: tomorrow, items: [{ _id: '222222222222222222222222', quantity: 1 }], customerInfo: { fullName: 'Khách', address: 'Địa chỉ', note: '<script>note</script>', paymentMethod: 'cod' } };
  async function post(changes) {
    const result = await api.request('customer/checkout', 'POST', { ...valid, ...changes });
    if (result.body.success) saved.push(result.body.order);
    return result;
  }
  try {
    const result = await post({ voucherCode: 'TEST', total: 1, status: 'completed', stockReserved: false, paymentStatus: 'REFUNDED', customerId: 'foreign', cardMessage: '<script>alert(1)</script>' });
    assert.equal(result.status, 200);
    assert.equal(result.body.order.deliveryDate, tomorrow);
    assert.equal(result.body.order.deliveryTimeSlot, base.deliveryTimeSlot);
    assert.equal(result.body.order.cardMessage, '<script>alert(1)</script>');
    assert.equal(saved[0].customerInfo.note, '<script>note</script>');
    assert.equal(result.body.order.customer._id, owner);
    assert.equal(result.body.order.status, 'pending');
    assert.equal(result.body.order.paymentStatus, 'Chờ thanh toán khi nhận hàng');
    assert.deepEqual(result.body.pricing, { subtotal: 500000, discount: 50000, shippingFee: 30000, total: 480000 });
    assert.equal(store.state.vouchers.v.usedCount, 1);
    assert.equal(result.body.order.stockReserved, true);
    assert.equal(store.state.products[valid.items[0]._id].stock, 29);
    assert.equal((await post({ cardMessage: undefined })).status, 200);
    assert.equal(saved[1].cardMessage, '');
    assert.equal((await post({ deliveryDate: delivery.vietnamToday() })).status, 200);
    for (const paymentMethod of ['bank', 'momo']) {
      const result = await post({ customerInfo: { ...valid.customerInfo, paymentMethod } });
      assert.equal(result.body.order.paymentStatus, 'Thanh toán demo - chưa xác minh');
    }
    const count = saved.length;
    for (const changes of [{ deliveryDate: '2000-01-01' }, { deliveryDate: '2026-02-30' }, { deliveryDate: {} }, { deliveryTimeSlot: 'bad' }, { deliveryTimeSlot: [] }, { cardMessage: 'x'.repeat(301) }, { cardMessage: {} }, { deliveryDate: undefined }, { customerInfo: { paymentMethod: 'fake' } }]) {
      const result = await post(changes);
      assert.equal(result.status, 400, JSON.stringify(changes));
      assert.equal(result.body.success, false);
    }
    assert.equal(saved.length, count);
  } finally { await api.close(); }
});
