const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, http } = require('./helpers/order-store');
const orderId = '3'.repeat(24), productId = '1'.repeat(24), owner = '4'.repeat(24);

function fixture(reserved = true, status = 'pending') {
  const s = setup();
  s.state.orders[orderId] = {
    _id: orderId, status, customer: { _id: owner }, voucherCode: ' test ',
    ...(reserved === 'missing' ? {} : { stockReserved: reserved }),
    items: [{ product: { _id: productId }, quantity: 2 }]
  };
  s.state.products[productId] = { _id: productId, stock: 3, sold: 0 };
  s.state.vouchers.v = { _id: 'v', code: 'TEST', usedCount: 1 };
  return s;
}
const cancel = (s, actor = 'customer') => s.lifecycle.transition(orderId, 'canceled', actor, owner);

for (const reserved of [true, false, 'missing']) {
  test(`${reserved}: reserved/legacy cancel, voucher release, sequential and concurrent retry`, async () => {
    for (const [actor, status] of [['customer', 'pending'], ['admin', 'approved'], ['staff', 'pending']]) {
      const s = fixture(reserved, status);
      const results = await Promise.all([cancel(s, actor), cancel(s, actor)]);
      assert.equal(results.filter(result => !result.unchanged).length, 1);
      assert.equal(s.state.orders[orderId].status, 'canceled');
      assert.equal(s.state.products[productId].stock, reserved === true ? 5 : 3);
      assert.equal(s.state.products[productId].sold, 0);
      assert.equal(s.state.vouchers.v.usedCount, 0);
      // Even if the voucher later disappears, a committed cancel is a no-op.
      delete s.state.vouchers.v;
      const before = JSON.stringify(s.state), writes = s.writes.length;
      assert.equal((await cancel(s, actor)).unchanged, true);
      assert.equal(JSON.stringify(s.state), before); assert.equal(s.writes.length, writes);
    }
  });
}

test('no voucher means no voucher access/write; release does not depend on active/expiry', async () => {
  const without = fixture(); delete without.state.orders[orderId].voucherCode;
  await cancel(without);
  assert.equal(without.state.vouchers.v.usedCount, 1);
  assert.equal(without.writes.filter(write => write.collection === 'vouchers').length, 0);
  const expired = fixture(); Object.assign(expired.state.vouchers.v, { isActive: false, endDate: 1 });
  await cancel(expired); assert.equal(expired.state.vouchers.v.usedCount, 0);
});

test('missing/zero/negative/fractional/invalid counters fail closed without reconciliation', async () => {
  for (const counter of ['absent-voucher', undefined, null, 0, -1, 0.5, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const s = fixture();
    if (counter === 'absent-voucher') delete s.state.vouchers.v;
    else if (counter === undefined) delete s.state.vouchers.v.usedCount;
    else s.state.vouchers.v.usedCount = counter;
    const before = JSON.stringify(s.state);
    await assert.rejects(() => cancel(s), { status: 409, code: 'VOUCHER_RELEASE_CONFLICT' });
    assert.equal(JSON.stringify(s.state), before);
  }
  const miss = fixture(); miss.faults.voucherMiss = true;
  const before = JSON.stringify(miss.state);
  await assert.rejects(() => cancel(miss), { code: 'VOUCHER_RELEASE_CONFLICT' });
  assert.equal(JSON.stringify(miss.state), before);
});

test('stock, voucher, status and commit failures leave no partial cancellation', async () => {
  for (const fault of ['products', 'vouchers', 'orders', 'stale', 'commit', 'unsupported']) {
    const s = fixture(); s.faults[fault] = true;
    const before = JSON.stringify(s.state);
    await assert.rejects(() => cancel(s));
    assert.equal(JSON.stringify(s.state), before, fault);
    assert.equal(s.stats().ended, 1);
  }
});

test('callback retry does not persist duplicate stock/voucher increments', async () => {
  const s = fixture(); s.faults.retryOnce = true;
  await cancel(s);
  assert.equal(s.stats().retries, 1);
  assert.equal(s.state.products[productId].stock, 5);
  assert.equal(s.state.vouchers.v.usedCount, 0);
});

test('separate orders sharing a voucher serialize release; counter cannot underflow', async () => {
  for (const count of [1, 2]) {
    const s = fixture(); const second = '6'.repeat(24);
    s.state.orders[second] = { ...s.state.orders[orderId], _id: second };
    s.state.vouchers.v.usedCount = count;
    const result = await Promise.allSettled([cancel(s), s.lifecycle.transition(second, 'canceled', 'customer', owner)]);
    assert.equal(result.filter(row => row.status === 'fulfilled').length, count);
    assert.equal(s.state.vouchers.v.usedCount, 0);
    assert.equal(s.state.products[productId].stock, 3 + 2 * count);
    assert.equal(Object.values(s.state.orders).filter(row => row.status === 'canceled').length, count);
  }
});

test('pending approve vs customer cancel: stale losing transition has no persisted effects', async () => {
  for (const approvalFirst of [true, false]) {
    const s = fixture();
    const approve = () => s.lifecycle.transition(orderId, 'approved', 'admin');
    const actions = approvalFirst ? [approve, () => cancel(s)] : [() => cancel(s), approve];
    const result = await Promise.allSettled(actions.map(run => run()));
    assert.equal(result.filter(row => row.status === 'fulfilled').length, 1);
    const canceled = s.state.orders[orderId].status === 'canceled';
    assert.equal(s.state.products[productId].stock, canceled ? 5 : 3);
    assert.equal(s.state.vouchers.v.usedCount, canceled ? 0 : 1);
    assert.equal(s.state.products[productId].sold, 0);
  }
});

test('admin approve vs cancel freezes original pending status: exactly one winner', async () => {
  for (const approveFirst of [true, false]) {
    const s = fixture();
    const approve = () => s.lifecycle.transition(orderId, 'approved', 'admin');
    const actions = approveFirst ? [approve, () => cancel(s, 'admin')] : [() => cancel(s, 'admin'), approve];
    const results = await Promise.allSettled(actions.map(run => run()));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.find(result => result.status === 'fulfilled').value.unchanged, false);
    assert.equal(results.find(result => result.status === 'rejected').reason.code, 'STALE_ORDER_STATUS');
    const canceled = s.state.orders[orderId].status === 'canceled';
    assert.equal(s.state.products[productId].stock, canceled ? 5 : 3);
    assert.equal(s.state.vouchers.v.usedCount, canceled ? 0 : 1);
    assert.equal(s.state.products[productId].sold, 0);
  }
});

test('cancel retry after competing approval retains pending FROM and makes no retry writes', async () => {
  const s = fixture(); let injected = false, writesAfterApproval;
  s.faults.beforeCommit = async () => {
    if (injected) return;
    injected = true;
    await s.lifecycle.transition(orderId, 'approved', 'admin');
    writesAfterApproval = s.writes.length;
  };
  await assert.rejects(() => cancel(s, 'admin'), { status: 409, code: 'STALE_ORDER_STATUS' });
  assert.equal(s.stats().retries, 1);
  assert.equal(s.writes.length, writesAfterApproval);
  assert.equal(s.state.orders[orderId].status, 'approved');
  assert.equal(s.state.products[productId].stock, 3);
  assert.equal(s.state.products[productId].sold, 0);
  assert.equal(s.state.vouchers.v.usedCount, 1);
  assert.ok(s.writes.filter(write => write.collection === 'orders').every(write => write.filter.status === 'pending'));
});

test('HTTP competing admin approve/cancel from pending returns 200/409, never 200/200', async () => {
  const s = fixture(); const api = await http(s);
  let arrivals = 0, release;
  const barrier = new Promise(resolve => { release = resolve; });
  // Ensure both HTTP requests observe pending before either attempt commits.
  s.faults.beforeCommit = async () => {
    arrivals++;
    if (arrivals === 2) release();
    await barrier;
  };
  try {
    const url = `admin/orders/${orderId}/status`;
    const results = await Promise.all(['approved', 'canceled'].map(status => api.request(url, 'PUT', { status }, 'admin')));
    assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
    assert.equal(results.find(result => result.status === 409).body.code, 'STALE_ORDER_STATUS');
    const winner = results.find(result => result.status === 200).body.order.status;
    assert.equal(s.state.orders[orderId].status, winner);
    assert.equal(s.state.products[productId].stock, winner === 'canceled' ? 5 : 3);
    assert.equal(s.state.vouchers.v.usedCount, winner === 'canceled' ? 0 : 1);
    assert.equal(s.state.products[productId].sold, 0);
  } finally { await api.close(); }
});

test('completion retry and forbidden cancel preserve voucher count and terminal inventory', async () => {
  const s = fixture(true, 'delivering');
  await s.lifecycle.transition(orderId, 'completed', 'admin');
  const before = JSON.stringify(s.state), writes = s.writes.length;
  assert.equal((await s.lifecycle.transition(orderId, 'completed', 'admin')).unchanged, true);
  await assert.rejects(() => cancel(s, 'admin'), { code: 'INVALID_TRANSITION' });
  assert.equal(JSON.stringify(s.state), before); assert.equal(s.writes.length, writes);
  assert.equal(s.state.products[productId].sold, 2); assert.equal(s.state.vouchers.v.usedCount, 1);
});

test('HTTP lost commit acknowledgement then retry returns committed state without another release', async t => {
  const s = fixture(); const api = await http(s);
  t.mock.method(console, 'error', () => {});
  try {
    s.faults.commitResponseLost = true;
    const url = `customer/orders/${orderId}/cancel`;
    const first = await api.request(url, 'PUT', {});
    assert.equal(first.status, 503); assert.equal(first.body.code, 'ORDER_TRANSACTION_FAILED');
    assert.equal(s.state.orders[orderId].status, 'canceled');
    const before = JSON.stringify(s.state), writes = s.writes.length;
    const retry = await api.request(url, 'PUT', {});
    assert.equal(retry.status, 200); assert.equal(retry.body.success, true);
    assert.equal(retry.body.order.status, 'canceled');
    assert.equal(JSON.stringify(s.state), before); assert.equal(s.writes.length, writes);
    assert.equal(s.state.products[productId].stock, 5); assert.equal(s.state.vouchers.v.usedCount, 0);
  } finally { await api.close(); }
});

test('HTTP ownership/auth and inconsistent voucher responses do not mutate state', async () => {
  const s = fixture(); const api = await http(s);
  try {
    const before = JSON.stringify(s.state);
    const url = `customer/orders/${orderId}/cancel`;
    assert.equal((await api.request(url, 'PUT', {}, 'customer', '5'.repeat(24))).status, 403);
    assert.equal((await api.request(url, 'PUT', {}, '')).status, 401);
    assert.equal((await api.request(`admin/orders/${orderId}/status`, 'PUT', { status: 'canceled' }, 'customer')).status, 403);
    assert.equal(JSON.stringify(s.state), before); assert.equal(s.writes.length, 0);
    s.state.vouchers.v.usedCount = 0;
    const inconsistent = JSON.stringify(s.state);
    const response = await api.request(url, 'PUT', {});
    assert.equal(response.status, 409); assert.equal(response.body.code, 'VOUCHER_RELEASE_CONFLICT');
    assert.equal(JSON.stringify(s.state), inconsistent);
    assert.equal('stack' in response.body, false);
  } finally { await api.close(); }
});
test('customer delivery tracking exposes only public timestamps', async () => {
  const s = fixture(true, 'completed');

  const startedAt = 1789701000000;
  const deliveredAt = 1789704600000;

  s.state.orders[orderId].delivery = {
    assignedStaff: {
      id: '6'.repeat(24),
      name: 'Staff Internal'
    },
    assignedAt: 1789699000000,
    assignedBy: {
      id: '7'.repeat(24),
      role: 'admin',
      name: 'Admin Internal'
    },
    startedAt,
    deliveredAt,
    attempts: [
      {
        result: 'failed',
        reason: 'customer_unavailable',
        note: 'Internal delivery note',
        attemptedAt: 1789702000000
      }
    ]
  };

  // Test helper không có Models.Order.find(),
  // nên mock riêng customer order listing cho test này.
  s.orderDAO.selectByCustID = async customerId => {
    return Object.values(s.state.orders).filter(
      order =>
        String(order.customer?._id || '') ===
        String(customerId)
    );
  };

  const api = await http(s);

  try {
    const response = await api.request(
      'customer/orders',
      'GET'
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);

    const order = response.body.orders.find(
      item => item._id === orderId
    );

    assert.ok(order);

    assert.deepEqual(order.deliveryTracking, {
      startedAt,
      deliveredAt
    });

    assert.equal('delivery' in order, false);

    const serialized = JSON.stringify(order);

    assert.equal(
      serialized.includes('assignedStaff'),
      false
    );

    assert.equal(
      serialized.includes('assignedBy'),
      false
    );

    assert.equal(
      serialized.includes('attempts'),
      false
    );

    assert.equal(
      serialized.includes('Internal delivery note'),
      false
    );

    assert.equal(
      serialized.includes('customer_unavailable'),
      false
    );

    // Legacy order không có delivery vẫn phải hoạt động.
    delete s.state.orders[orderId].delivery;

    const legacyResponse = await api.request(
      'customer/orders',
      'GET'
    );

    assert.equal(legacyResponse.status, 200);

    const legacyOrder = legacyResponse.body.orders.find(
      item => item._id === orderId
    );

    assert.ok(legacyOrder);
    assert.equal(
      'deliveryTracking' in legacyOrder,
      false
    );
    assert.equal('delivery' in legacyOrder, false);
  } finally {
    await api.close();
  }
});
test('staff order listing is scoped to assigned deliveries', async () => {
  const s = fixture(true, 'approved');

  const staffA = '6'.repeat(24);
  const staffB = '7'.repeat(24);

  const orderA = orderId;
  const orderB = '8'.repeat(24);
  const unassignedOrder = '9'.repeat(24);

  s.state.orders[orderA] = {
    ...s.state.orders[orderA],
    _id: orderA,
    status: 'preparing',
    delivery: {
      assignedStaff: {
        id: staffA,
        name: 'Staff A'
      }
    }
  };

  s.state.orders[orderB] = {
    ...s.state.orders[orderA],
    _id: orderB,
    delivery: {
      assignedStaff: {
        id: staffB,
        name: 'Staff B'
      }
    }
  };

  s.state.orders[unassignedOrder] = {
    ...s.state.orders[orderA],
    _id: unassignedOrder,
    delivery: undefined
  };

  s.orderDAO.selectAll = async () => {
    return Object.values(s.state.orders);
  };

  s.orderDAO.selectByAssignedStaff = async staffId => {
    return Object.values(s.state.orders).filter(
      order =>
        String(order.delivery?.assignedStaff?.id || '') ===
        String(staffId)
    );
  };

  s.orderDAO.selectByAssignedStaffAndCustomer = async (
    staffId,
    customerId
  ) => {
    return Object.values(s.state.orders).filter(
      order =>
        String(order.delivery?.assignedStaff?.id || '') ===
          String(staffId) &&
        String(order.customer?._id || '') ===
          String(customerId)
    );
  };

  s.orderDAO.selectByCustID = async customerId => {
    return Object.values(s.state.orders).filter(
      order =>
        String(order.customer?._id || '') ===
        String(customerId)
    );
  };

  const api = await http(s);

  try {
    const adminResponse = await api.request(
      'admin/orders',
      'GET',
      undefined,
      'admin'
    );

    assert.equal(adminResponse.status, 200);
    assert.equal(adminResponse.body.orders.length, 3);

    const staffAResponse = await api.request(
      'admin/orders',
      'GET',
      undefined,
      'staff',
      staffA
    );

    assert.equal(staffAResponse.status, 200);

    assert.deepEqual(
      staffAResponse.body.orders.map(order => order._id),
      [orderA]
    );

    const staffBResponse = await api.request(
      'admin/orders',
      'GET',
      undefined,
      'staff',
      staffB
    );

    assert.equal(staffBResponse.status, 200);

    assert.deepEqual(
      staffBResponse.body.orders.map(order => order._id),
      [orderB]
    );

    assert.equal(
      staffAResponse.body.orders.some(
        order => order._id === unassignedOrder
      ),
      false
    );

    const customerScopedResponse = await api.request(
      `admin/orders/customer/${owner}`,
      'GET',
      undefined,
      'staff',
      staffA
    );

    assert.equal(customerScopedResponse.status, 200);

    assert.deepEqual(
      customerScopedResponse.body.orders.map(order => order._id),
      [orderA]
    );
  } finally {
    await api.close();
  }
});