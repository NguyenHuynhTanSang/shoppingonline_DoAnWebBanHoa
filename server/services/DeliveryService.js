const Models = require('../models/Models');
const OrderDAO = require('../models/OrderDAO');

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

function getAssignedStaffId(order) {
  const value = order?.delivery?.assignedStaff?.id;
  return value ? String(value) : '';
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

function errorResponse(res, error) {
  if (error instanceof DeliveryError) {
    return res.status(error.status).json({
      success: false,
      code: error.code,
      message: error.message
    });
  }

  console.error('Delivery assignment failed');

  return res.status(503).json({
    success: false,
    code: 'DELIVERY_OPERATION_FAILED',
    message: 'Chưa thể xử lý phân công giao hàng. Vui lòng thử lại sau.'
  });
}

module.exports = {
  DeliveryError,
  errorResponse,
  assignStaff,
  clearAssignment
};