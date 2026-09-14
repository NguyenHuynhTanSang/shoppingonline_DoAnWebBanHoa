const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const policy = require('../utils/OrderStateMachine');
const statuses = ['pending', 'approved', 'preparing', 'delivering', 'completed', 'canceled'];
const edges = ['pending:approved', 'pending:canceled', 'approved:preparing', 'approved:canceled', 'preparing:delivering', 'delivering:completed'];

test('full pure matrix: roles, terminal states, malformed values and same-state separation', () => {
  for (const actor of ['admin', 'staff', 'customer', 'unknown']) {
    for (const from of statuses) for (const to of statuses) {
      const expected = actor === 'customer' ? from === 'pending' && to === 'canceled' :
        ['admin', 'staff'].includes(actor) && edges.includes(`${from}:${to}`);
      assert.equal(policy.canTransitionOrder(from, to, actor), expected, `${actor}:${from}:${to}`);
    }
  }
  for (const value of [null, {}, [], 0, 'unknown', '__proto__', 'PENDING']) {
    assert.equal(policy.isValidOrderStatus(value), false);
    assert.equal(policy.canTransitionOrder(value, 'approved', 'admin'), false);
    assert.equal(policy.canTransitionOrder('pending', value, 'admin'), false);
  }
  for (const status of statuses) assert.equal(policy.isValidOrderStatus(status), true);
});

test('direct HTTP full matrix preserves ownership and inventory/no-op effects', async () => {
  const { setup, http } = require('./helpers/order-store');
  const store = setup();
  const api = await http(store);
  const id = '3'.repeat(24), pid = '1'.repeat(24), owner = '4'.repeat(24);
  function reset(status) {
    store.state.orders[id] = { _id: id, status, stockReserved: true, customer: { _id: owner }, voucherCode: 'TEST', items: [{ product: { _id: pid }, quantity: 1 }] };
    store.state.products[pid] = { _id: pid, stock: 2, sold: 0 };
    store.state.vouchers.v = { _id: 'v', code: 'TEST', usedCount: 1 };
    store.writes.length = 0;
  }
  const request = (actor, to, customerId = owner) => api.request(
    actor === 'customer' ? `customer/orders/${id}/cancel` : `admin/orders/${id}/status`, 'PUT', { status: to }, actor, customerId);
  try {
    for (const actor of ['admin', 'staff']) for (const from of statuses) for (const to of statuses) {
      reset(from);
      const response = await request(actor, to);
      const workflowRequired =
  actor === 'staff' &&
  ['delivering', 'completed'].includes(to);

const changed =
  !workflowRequired &&
  edges.includes(`${from}:${to}`);

const expectedStatus =
  workflowRequired
    ? 403
    : from === to || changed
      ? 200
      : 409;

assert.equal(
  response.status,
  expectedStatus,
  `${actor}:${from}:${to}`
);

assert.equal(
  response.body.success,
  workflowRequired
    ? false
    : from === to || changed
);
      assert.equal(store.state.orders[id].status, changed ? to : from);
      assert.equal(store.state.products[pid].stock, changed && to === 'canceled' ? 3 : 2);
      assert.equal(store.state.products[pid].sold, changed && to === 'completed' ? 1 : 0);
      assert.equal(store.state.vouchers.v.usedCount, changed && to === 'canceled' ? 0 : 1);
      if (!changed) assert.equal(store.writes.length, 0);
    }
    for (const from of statuses) {
      reset(from);
      const response = await request('customer', 'canceled');
      assert.equal(response.status, ['pending', 'canceled'].includes(from) ? 200 : 409);
      assert.equal(store.state.products[pid].stock, from === 'pending' ? 3 : 2);
    }
    reset('pending');
    assert.equal((await request('customer', 'canceled', '5'.repeat(24))).status, 403);
    assert.equal((await request('unknown', 'approved')).status, 403);
    assert.equal((await request('', 'approved')).status, 401);
    for (const value of ['', null, {}, [], 'unknown']) assert.equal((await request('admin', value)).status, 400);
    assert.equal(store.writes.length, 0);
    delete store.state.orders[id];
    assert.equal((await request('admin', 'approved')).status, 404);
    assert.equal((await request('customer', 'canceled')).status, 404);
  } finally { await api.close(); }
});
