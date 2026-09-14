const test = require('node:test');
const assert = require('node:assert/strict');

const Models = require('../models/Models');
const OrderDAO = require('../models/OrderDAO');
const OrderLifecycle = require('../services/OrderLifecycleService');
const DeliveryService = require('../services/DeliveryService');

const {
  DELIVERY_ATTEMPT_LIMIT
} = require('../utils/DeliveryWorkflow');

const ORDER_ID = '1'.repeat(24);
const STAFF_A = '2'.repeat(24);
const STAFF_B = '3'.repeat(24);

function staffActor(id = STAFF_A) {
  return {
    id,
    role: 'staff'
  };
}

function makeOrder(status = 'preparing', staffId = STAFF_A, attempts = []) {
  return {
    _id: ORDER_ID,
    status,
    delivery: {
      assignedStaff: {
        id: staffId,
        name: 'Staff'
      },
      assignedAt: 1,
      assignedBy: {
        id: '4'.repeat(24),
        role: 'admin',
        name: 'Admin'
      },
      attempts
    }
  };
}

test('DELIVERY-003 staff delivery workflow', async (t) => {
  const originalSelectByID = OrderDAO.selectByID;
  const originalAppend = OrderDAO.appendDeliveryAttempt;
  const originalTransition = OrderLifecycle.transition;
  const originalStaffFindById = Models.Staff.findById;

  let order = makeOrder();
  let lifecycleCalls = [];
  let appendReturnsNull = false;

  OrderDAO.selectByID = async () => order;

  OrderDAO.appendDeliveryAttempt = async (orderId, staffId, attempt) => {
    if (appendReturnsNull) return null;

    if (
      String(order?._id) !== String(orderId) ||
      String(order?.status || '').toLowerCase() !== 'delivering' ||
      String(order?.delivery?.assignedStaff?.id || '') !== String(staffId)
    ) {
      return null;
    }

    const attempts = Array.isArray(order.delivery?.attempts)
      ? order.delivery.attempts
      : [];

    if (attempts.length >= DELIVERY_ATTEMPT_LIMIT) {
      return null;
    }

    order = {
      ...order,
      delivery: {
        ...order.delivery,
        attempts: [
          ...attempts,
          attempt
        ]
      }
    };

    return order;
  };

  OrderLifecycle.transition = async (
    orderId,
    to,
    actor,
    customerId,
    context
  ) => {
    lifecycleCalls.push({
      orderId,
      to,
      actor,
      customerId,
      context
    });

    order = {
      ...order,
      status: to,
      delivery: {
        ...order.delivery,
        ...(context?.startedAt !== undefined
          ? { startedAt: context.startedAt }
          : {}),
        ...(context?.deliveredAt !== undefined
          ? { deliveredAt: context.deliveredAt }
          : {})
      }
    };

    return {
      order,
      unchanged: false
    };
  };

  t.after(() => {
    OrderDAO.selectByID = originalSelectByID;
    OrderDAO.appendDeliveryAttempt = originalAppend;
    OrderLifecycle.transition = originalTransition;
    Models.Staff.findById = originalStaffFindById;
  });

  await t.test('assigned staff starts delivery and retry is safe', async () => {
    order = makeOrder('preparing');
    lifecycleCalls = [];

    const first = await DeliveryService.startDelivery(
      ORDER_ID,
      staffActor()
    );

    assert.equal(first.unchanged, false);
    assert.equal(first.order.status, 'delivering');
    assert.equal(lifecycleCalls.length, 1);
    assert.equal(lifecycleCalls[0].to, 'delivering');
    assert.equal(lifecycleCalls[0].context.staffId, STAFF_A);
    assert.equal(
      Number.isSafeInteger(lifecycleCalls[0].context.startedAt),
      true
    );

    const retry = await DeliveryService.startDelivery(
      ORDER_ID,
      staffActor()
    );

    assert.equal(retry.unchanged, true);
    assert.equal(lifecycleCalls.length, 1);
  });

  await t.test('only assigned staff may operate delivery', async () => {
    order = makeOrder('preparing', STAFF_A);

    await assert.rejects(
      DeliveryService.startDelivery(
        ORDER_ID,
        staffActor(STAFF_B)
      ),
      (error) => {
        assert.equal(error.status, 403);
        assert.equal(error.code, 'DELIVERY_NOT_ASSIGNED');
        return true;
      }
    );

    await assert.rejects(
      DeliveryService.startDelivery(
        ORDER_ID,
        {
          id: STAFF_A,
          role: 'admin'
        }
      ),
      (error) => {
        assert.equal(error.status, 403);
        assert.equal(error.code, 'DELIVERY_STAFF_FORBIDDEN');
        return true;
      }
    );
  });

  await t.test('failed attempt stays delivering and retry is recorded', async () => {
    order = makeOrder('delivering');
    appendReturnsNull = false;

    const first = await DeliveryService.failDelivery(
      ORDER_ID,
      {
        reason: 'customer_unavailable',
        note: 'Khách chưa nghe máy'
      },
      staffActor()
    );

    assert.equal(first.order.status, 'delivering');
    assert.equal(first.order.delivery.attempts.length, 1);
    assert.equal(
      first.order.delivery.attempts[0].reason,
      'customer_unavailable'
    );

    const second = await DeliveryService.failDelivery(
      ORDER_ID,
      {
        reason: 'customer_rescheduled',
        note: 'Khách hẹn giao lại'
      },
      staffActor()
    );

    assert.equal(second.order.status, 'delivering');
    assert.equal(second.order.delivery.attempts.length, 2);
  });

  await t.test('invalid failure input is rejected without write', async () => {
    order = makeOrder('delivering');

    await assert.rejects(
      DeliveryService.failDelivery(
        ORDER_ID,
        {
          reason: 'made_up_reason'
        },
        staffActor()
      ),
      (error) => {
        assert.equal(error.status, 400);
        assert.equal(error.code, 'INVALID_DELIVERY_FAILURE_REASON');
        return true;
      }
    );

    await assert.rejects(
      DeliveryService.failDelivery(
        ORDER_ID,
        {
          reason: 'other',
          note: 'x'.repeat(301)
        },
        staffActor()
      ),
      (error) => {
        assert.equal(error.status, 400);
        assert.equal(error.code, 'INVALID_DELIVERY_NOTE');
        return true;
      }
    );

    assert.equal(order.delivery.attempts.length, 0);
  });

  await t.test('attempt limit and stale writes fail closed', async () => {
    order = makeOrder(
      'delivering',
      STAFF_A,
      Array.from(
        { length: DELIVERY_ATTEMPT_LIMIT },
        (_, index) => ({
          attemptedAt: index + 1,
          result: 'failed',
          reason: 'other',
          note: '',
          actorId: STAFF_A
        })
      )
    );

    await assert.rejects(
      DeliveryService.failDelivery(
        ORDER_ID,
        {
          reason: 'other'
        },
        staffActor()
      ),
      (error) => {
        assert.equal(error.status, 409);
        assert.equal(error.code, 'DELIVERY_ATTEMPT_LIMIT_REACHED');
        return true;
      }
    );

    order = makeOrder('delivering');
    appendReturnsNull = true;

    await assert.rejects(
      DeliveryService.failDelivery(
        ORDER_ID,
        {
          reason: 'delivery_issue'
        },
        staffActor()
      ),
      (error) => {
        assert.equal(error.status, 409);
        assert.equal(error.code, 'DELIVERY_ACTION_STALE');
        return true;
      }
    );

    appendReturnsNull = false;
  });

  await t.test('assigned staff completes only an active delivery', async () => {
    order = makeOrder('delivering');
    lifecycleCalls = [];

    const result = await DeliveryService.completeDelivery(
      ORDER_ID,
      staffActor()
    );

    assert.equal(result.order.status, 'completed');
    assert.equal(lifecycleCalls.length, 1);
    assert.equal(lifecycleCalls[0].to, 'completed');
    assert.equal(lifecycleCalls[0].context.staffId, STAFF_A);
    assert.equal(
      Number.isSafeInteger(lifecycleCalls[0].context.deliveredAt),
      true
    );

    const retry = await DeliveryService.completeDelivery(
      ORDER_ID,
      staffActor()
    );

    assert.equal(retry.unchanged, true);
    assert.equal(lifecycleCalls.length, 1);
  });
});