const Models = require('../models/Models');
const OrderDAO = require('../models/OrderDAO');
const OrderLifecycle = require('./OrderLifecycleService');

const {
  DELIVERY_FAILURE_REASONS,
  DELIVERY_ATTEMPT_NOTE_LIMIT,
  DELIVERY_ATTEMPT_LIMIT
} = require('../utils/DeliveryWorkflow');

const ASSIGNABLE_STATUSES = new Set(['approved', 'preparing']);

class DeliveryError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function isObjectId(value) {
  return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function requireAdmin(actor) {
  const id = String(actor?.id || actor?.sub || '').trim();
  const role = String(actor?.role || '').trim().toLowerCase();
  const name = String(actor?.name || actor?.username || '').trim();

  if (role !== 'admin' || !isObjectId(id)) {
    throw new DeliveryError(
      403,
      'DELIVERY_ASSIGNMENT_FORBIDDEN',
      'Chỉ admin mới được phân công nhân viên giao hàng.'
    );
  }

  return {
    id,
    role: 'admin',
    name
  };
}

function requireStaff(actor) {
  const id = String(actor?.id || actor?.sub || '').trim();
  const role = String(actor?.role || '').trim().toLowerCase();

  if (role !== 'staff' || !isObjectId(id)) {
    throw new DeliveryError(
      403,
      'DELIVERY_STAFF_FORBIDDEN',
      'Chỉ nhân viên giao hàng mới được thực hiện thao tác này.'
    );
  }

  return {
    id,
    role: 'staff'
  };
}

function requireValidOrderId(orderId) {
  const id = String(orderId || '').trim();

  if (!isObjectId(id)) {
    throw new DeliveryError(
      400,
      'INVALID_ORDER_ID',
      'Mã đơn hàng không hợp lệ.'
    );
  }

  return id;
}

function requireValidStaffId(staffId) {
  const id = String(staffId || '').trim();

  if (!isObjectId(id)) {
    throw new DeliveryError(
      400,
      'INVALID_STAFF_ID',
      'Mã nhân viên không hợp lệ.'
    );
  }

  return id;
}

function requireAssignableOrder(order) {
  if (!order) {
    throw new DeliveryError(
      404,
      'ORDER_NOT_FOUND',
      'Không tìm thấy đơn hàng.'
    );
  }

  const status = normalizeStatus(order.status);

  if (!ASSIGNABLE_STATUSES.has(status)) {
    throw new DeliveryError(
      409,
      'ORDER_NOT_ASSIGNABLE',
      'Chỉ có thể phân công giao hàng khi đơn đã xác nhận hoặc đang chuẩn bị.'
    );
  }

  return status;
}

function getAssignedStaffId(order) {
  const value = order?.delivery?.assignedStaff?.id;
  return value ? String(value) : '';
}

function requireAssignedOrder(order, staffId) {
  if (!order) {
    throw new DeliveryError(
      404,
      'ORDER_NOT_FOUND',
      'Không tìm thấy đơn hàng.'
    );
  }

  if (getAssignedStaffId(order) !== staffId) {
    throw new DeliveryError(
      403,
      'DELIVERY_NOT_ASSIGNED',
      'Bạn không được phân công giao đơn hàng này.'
    );
  }

  return normalizeStatus(order.status);
}

async function loadActiveStaff(staffId) {
  const staff = await Models.Staff.findById(staffId).exec();

  if (!staff) {
    throw new DeliveryError(
      404,
      'STAFF_NOT_FOUND',
      'Không tìm thấy nhân viên.'
    );
  }

  if (Number(staff.active) !== 1) {
    throw new DeliveryError(
      409,
      'STAFF_INACTIVE',
      'Nhân viên này hiện không hoạt động.'
    );
  }

  return staff;
}

async function assignStaff(orderId, staffId, actor) {
  const safeOrderId = requireValidOrderId(orderId);
  const safeStaffId = requireValidStaffId(staffId);
  const assignedBy = requireAdmin(actor);

  const order = await OrderDAO.selectByID(safeOrderId);

  requireAssignableOrder(order);

  const staff = await loadActiveStaff(safeStaffId);
  const currentStaffId = getAssignedStaffId(order);

  if (currentStaffId === safeStaffId) {
    return {
      order,
      unchanged: true
    };
  }

  const staffName = String(
    staff.name || staff.username || 'Nhân viên'
  ).trim();

  const assignment = {
    assignedStaff: {
      id: String(staff._id),
      name: staffName || 'Nhân viên'
    },

    assignedAt: Date.now(),

    assignedBy
  };

  const saved = await OrderDAO.assignDeliveryStaff(
    safeOrderId,
    assignment,
    currentStaffId || null
  );

  if (!saved) {
    throw new DeliveryError(
      409,
      'DELIVERY_ASSIGNMENT_STALE',
      'Đơn hàng hoặc phân công đã thay đổi. Vui lòng tải lại và thử lại.'
    );
  }

  return {
    order: saved,
    unchanged: false
  };
}

async function clearAssignment(orderId, actor) {
  const safeOrderId = requireValidOrderId(orderId);

  requireAdmin(actor);

  const order = await OrderDAO.selectByID(safeOrderId);

  requireAssignableOrder(order);

  const currentStaffId = getAssignedStaffId(order);

  if (!currentStaffId) {
    return {
      order,
      unchanged: true
    };
  }

  const saved = await OrderDAO.clearDeliveryAssignment(
    safeOrderId,
    currentStaffId
  );

  if (!saved) {
    throw new DeliveryError(
      409,
      'DELIVERY_ASSIGNMENT_STALE',
      'Đơn hàng hoặc phân công đã thay đổi. Vui lòng tải lại và thử lại.'
    );
  }

  return {
    order: saved,
    unchanged: false
  };
}

async function startDelivery(orderId, actor) {
  const safeOrderId = requireValidOrderId(orderId);
  const staff = requireStaff(actor);

  const order = await OrderDAO.selectByID(safeOrderId);
  const status = requireAssignedOrder(order, staff.id);

  if (status === 'delivering') {
    return {
      order,
      unchanged: true
    };
  }

  if (status !== 'preparing') {
    throw new DeliveryError(
      409,
      'DELIVERY_START_INVALID_STATE',
      'Chỉ đơn hàng đang chuẩn bị mới có thể bắt đầu giao.'
    );
  }

  return OrderLifecycle.transition(
    safeOrderId,
    'delivering',
    'staff',
    undefined,
    {
      staffId: staff.id,
      startedAt: Date.now()
    }
  );
}

async function failDelivery(orderId, input, actor) {
  const safeOrderId = requireValidOrderId(orderId);
  const staff = requireStaff(actor);

  const body =
    input && typeof input === 'object' && !Array.isArray(input)
      ? input
      : {};

  const reason =
    typeof body.reason === 'string'
      ? body.reason.trim().toLowerCase()
      : '';

  if (!DELIVERY_FAILURE_REASONS.includes(reason)) {
    throw new DeliveryError(
      400,
      'INVALID_DELIVERY_FAILURE_REASON',
      'Lý do giao hàng thất bại không hợp lệ.'
    );
  }

  if (body.note !== undefined && typeof body.note !== 'string') {
    throw new DeliveryError(
      400,
      'INVALID_DELIVERY_NOTE',
      'Ghi chú giao hàng không hợp lệ.'
    );
  }

  const note = String(body.note || '').trim();

  if (note.length > DELIVERY_ATTEMPT_NOTE_LIMIT) {
    throw new DeliveryError(
      400,
      'INVALID_DELIVERY_NOTE',
      `Ghi chú giao hàng không được quá ${DELIVERY_ATTEMPT_NOTE_LIMIT} ký tự.`
    );
  }

  const order = await OrderDAO.selectByID(safeOrderId);
  const status = requireAssignedOrder(order, staff.id);

  if (status !== 'delivering') {
    throw new DeliveryError(
      409,
      'DELIVERY_FAIL_INVALID_STATE',
      'Chỉ đơn hàng đang giao mới có thể ghi nhận giao thất bại.'
    );
  }

  const attempts = Array.isArray(order.delivery?.attempts)
    ? order.delivery.attempts
    : [];

  if (attempts.length >= DELIVERY_ATTEMPT_LIMIT) {
    throw new DeliveryError(
      409,
      'DELIVERY_ATTEMPT_LIMIT_REACHED',
      'Đơn hàng đã đạt giới hạn số lần ghi nhận giao thất bại.'
    );
  }

  const attempt = {
    attemptedAt: Date.now(),
    result: 'failed',
    reason,
    note,
    actorId: staff.id
  };

  const saved = await OrderDAO.appendDeliveryAttempt(
    safeOrderId,
    staff.id,
    attempt
  );

  if (!saved) {
    throw new DeliveryError(
      409,
      'DELIVERY_ACTION_STALE',
      'Trạng thái đơn hàng hoặc phân công đã thay đổi. Vui lòng tải lại.'
    );
  }

  return {
    order: saved,
    attempt
  };
}

async function completeDelivery(orderId, actor) {
  const safeOrderId = requireValidOrderId(orderId);
  const staff = requireStaff(actor);

  const order = await OrderDAO.selectByID(safeOrderId);
  const status = requireAssignedOrder(order, staff.id);

  if (status === 'completed') {
    return {
      order,
      unchanged: true
    };
  }

  if (status !== 'delivering') {
    throw new DeliveryError(
      409,
      'DELIVERY_COMPLETE_INVALID_STATE',
      'Chỉ đơn hàng đang giao mới có thể hoàn tất giao hàng.'
    );
  }

  return OrderLifecycle.transition(
    safeOrderId,
    'completed',
    'staff',
    undefined,
    {
      staffId: staff.id,
      deliveredAt: Date.now()
    }
  );
}

function errorResponse(res, error) {
  if (error instanceof DeliveryError) {
    return res.status(error.status).json({
      success: false,
      code: error.code,
      message: error.message
    });
  }

  if (error instanceof OrderLifecycle.OrderError) {
    return OrderLifecycle.errorResponse(res, error);
  }

  console.error('Delivery operation failed');

  return res.status(503).json({
    success: false,
    code: 'DELIVERY_OPERATION_FAILED',
    message: 'Chưa thể xử lý giao hàng. Vui lòng thử lại sau.'
  });
}

module.exports = {
  DeliveryError,
  errorResponse,
  assignStaff,
  clearAssignment,
  startDelivery,
  failDelivery,
  completeDelivery
};