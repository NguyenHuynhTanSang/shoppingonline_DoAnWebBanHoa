const test = require('node:test');
const assert = require('node:assert/strict');

const {
  setup
} = require('./helpers/order-store');

test('staff delivery lifecycle requires assignment context and keeps completion atomic', async () => {
  const store = setup();

  const orderId = '3'.repeat(24);
  const productId = '1'.repeat(24);
  const staffId = '6'.repeat(24);
  const wrongStaffId = '7'.repeat(24);

  store.state.orders[orderId] = {
    _id: orderId,
    status: 'preparing',
    stockReserved: true,

    customer: {
      _id: '4'.repeat(24)
    },

    customerInfo: {
      paymentMethod: 'cod'
    },

    paymentStatus: 'Chờ thanh toán khi nhận hàng',

    delivery: {
      assignedStaff: {
        id: staffId,
        name: 'Staff A'
      },
      assignedAt: 1,
      assignedBy: {
        id: '5'.repeat(24),
        role: 'admin',
        name: 'Admin'
      },
      attempts: []
    },

    items: [
      {
        product: {
          _id: productId
        },
        quantity: 1
      }
    ]
  };

  store.state.products[productId] = {
    _id: productId,
    stock: 2,
    sold: 0
  };

  await assert.rejects(
    store.lifecycle.transition(
      orderId,
      'delivering',
      'staff'
    ),
    (error) => {
      assert.equal(error.status, 403);
      assert.equal(error.code, 'DELIVERY_WORKFLOW_REQUIRED');
      return true;
    }
  );

  assert.equal(store.writes.length, 0);

  await assert.rejects(
    store.lifecycle.transition(
      orderId,
      'delivering',
      'staff',
      undefined,
      {
        staffId: wrongStaffId,
        startedAt: 100
      }
    ),
    (error) => {
      assert.equal(error.status, 403);
      assert.equal(error.code, 'DELIVERY_NOT_ASSIGNED');
      return true;
    }
  );

  assert.equal(store.writes.length, 0);

  const startResult =
    await store.lifecycle.transition(
      orderId,
      'delivering',
      'staff',
      undefined,
      {
        staffId,
        startedAt: 100
      }
    );

  assert.equal(
    startResult.order.status,
    'delivering'
  );

  const startWrite =
    store.writes.find(
      item =>
        item.collection === 'orders'
    );

  assert.equal(
    startWrite.filter['delivery.assignedStaff.id'],
    staffId
  );

  assert.equal(
    startWrite.update.$set['delivery.startedAt'],
    100
  );

  store.writes.length = 0;

  const completeResult =
    await store.lifecycle.transition(
      orderId,
      'completed',
      'staff',
      undefined,
      {
        staffId,
        deliveredAt: 200
      }
    );

  assert.equal(
    completeResult.order.status,
    'completed'
  );

  assert.equal(
    store.state.products[productId].sold,
    1
  );

  const completionWrite =
    store.writes.find(
      item =>
        item.collection === 'orders'
    );

  assert.equal(
    completionWrite.filter['delivery.assignedStaff.id'],
    staffId
  );

  assert.equal(
    completionWrite.update.$set['delivery.deliveredAt'],
    200
  );
});