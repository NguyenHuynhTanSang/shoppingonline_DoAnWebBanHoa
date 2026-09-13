const mongoose = require('mongoose');
const OrderDAO = require('../models/OrderDAO');
const ProductDAO = require('../models/ProductDAO');
const Models = require('../models/Models');
const PaymentPolicy = require('../utils/PaymentPolicy');
const { canTransitionOrder, isValidOrderStatus } = require('../utils/OrderStateMachine');

class OrderError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
function conflict(code, message) { return new OrderError(409, code, message); }
function errorResponse(res, error) {
  if (error instanceof OrderError) {
    return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  }
  // Never expose driver messages, topology, credentials or stack traces.
  console.error('Order transaction failed');
  return res.status(503).json({ success: false, code: 'ORDER_TRANSACTION_FAILED', message: 'Chưa thể xử lý đơn hàng. Vui lòng thử lại sau.' });
}
async function transaction(work) {
  const session = await mongoose.startSession();
  try {
    // Driver retries transient transaction errors/uncertain commits. Every
    // callback read/write must use this session; no HTTP/external effects here.
    let result;
    await session.withTransaction(async () => { result = await work(session); }, {
      readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary'
    });
    return result;
  } finally { await session.endSession(); }
}
function inventoryItems(items) {
  if (!Array.isArray(items) || !items.length) throw conflict('INVALID_ORDER_ITEMS', 'Sản phẩm trong đơn hàng không hợp lệ');
  const grouped = new Map();
  for (const item of items) {
    const id = String(item.product?._id || '');
    const qty = item.quantity;
    if (!/^[a-f\d]{24}$/i.test(id) || !Number.isSafeInteger(qty) || qty <= 0) {
      throw conflict('INVALID_ORDER_ITEMS', 'Sản phẩm trong đơn hàng không hợp lệ');
    }
    const quantity = (grouped.get(id) || 0) + qty;
    if (!Number.isSafeInteger(quantity)) throw conflict('INVALID_ORDER_ITEMS', 'Số lượng không hợp lệ');
    grouped.set(id, quantity);
  }
  return [...grouped].sort(([a], [b]) => a.localeCompare(b));
}
async function reserve(items, session) {
  for (const [id, quantity] of inventoryItems(items)) {
    if (!await ProductDAO.reserveStock(id, quantity, session)) {
      throw conflict('INSUFFICIENT_STOCK', 'Sản phẩm không tồn tại hoặc không đủ tồn kho');
    }
  }
}
async function consumeVoucher(voucher, session) {
  if (!voucher) return;
  const count = voucher.usedCount === undefined ? 0 : voucher.usedCount;
  const limit = voucher.usageLimit ?? 0;
  if (!Number.isSafeInteger(count) || count < 0 || count >= Number.MAX_SAFE_INTEGER ||
      !Number.isSafeInteger(limit) || limit < 0 || (limit > 0 && count >= limit)) {
    throw conflict('VOUCHER_USAGE_CONFLICT', 'Voucher đã hết lượt dùng hoặc dữ liệu lượt dùng không hợp lệ.');
  }
  const usage = { usedCount: { $eq: count, $lt: limit > 0 ? limit : Number.MAX_SAFE_INTEGER } };
  const filter = { _id: voucher._id, isActive: true,
    ...(count === 0 ? { $or: [usage, { usedCount: { $exists: false } }] } : usage) };
  // The validated voucher was read in this transaction. A concurrent rule/limit
  // edit conflicts with this write and callback retry validates fresh rules.
  const consumed = await Models.Voucher.findOneAndUpdate(filter,
    { $inc: { usedCount: 1 }, $set: { udate: Date.now() } }, { session }).exec();
  if (!consumed) throw conflict('VOUCHER_USAGE_CONFLICT', 'Voucher không còn lượt dùng. Vui lòng kiểm tra lại.');
}
async function reserveAndCreate(order, session, voucher) {
  if (!session?.inTransaction()) throw new Error('Checkout requires a transaction');
  await reserve(order.items, session);
  await consumeVoucher(voucher, session);
  return OrderDAO.insert({ ...order, status: 'pending', stockReserved: true }, session);
}
async function releaseVoucher(voucherCode, session) {
  if (!voucherCode) return;
  const voucher = await Models.Voucher.findOne({ code: String(voucherCode).trim().toUpperCase() }).session(session).exec();
  // Never guess historical consumption or silently cancel without releasing it.
  // Read and conditional decrement share the transaction with status/inventory.
  if (!voucher || !Number.isSafeInteger(voucher.usedCount) || voucher.usedCount < 1) {
    throw conflict('VOUCHER_RELEASE_CONFLICT', 'Chưa thể hủy đơn do dữ liệu lượt dùng voucher không nhất quán. Vui lòng liên hệ shop.');
  }
  const released = await Models.Voucher.findOneAndUpdate(
    { _id: voucher._id, usedCount: voucher.usedCount },
    { $inc: { usedCount: -1 }, $set: { udate: Date.now() } }, { session }
  ).exec();
  if (!released) throw conflict('VOUCHER_RELEASE_CONFLICT', 'Chưa thể hoàn lượt dùng voucher. Vui lòng tải lại đơn hàng.');
}
async function transition(orderId, to, actor, customerId) {
  if (!isValidOrderStatus(to)) throw new OrderError(400, 'INVALID_STATUS', 'Trạng thái không hợp lệ');
  if (!['admin', 'staff', 'customer'].includes(actor) || (actor === 'customer' && !customerId)) {
    throw new OrderError(403, 'FORBIDDEN', 'Không có quyền cập nhật đơn hàng');
  }
  if (!/^[a-f\d]{24}$/i.test(orderId)) throw new OrderError(400, 'INVALID_ORDER_ID', 'Mã đơn hàng không hợp lệ');
  // One request retains its first observed FROM across driver callback retries.
  // Keep the raw value for the DB guard, including legacy uppercase statuses.
  let expectation;
  return transaction(async session => {
    const order = await OrderDAO.selectByIDWithSession(orderId, session);
    if (!order) throw new OrderError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng');
    if (actor === 'customer' && String(order.customer?._id) !== String(customerId)) {
      throw new OrderError(403, 'FORBIDDEN', 'Bạn không có quyền hủy đơn hàng này');
    }
    if (!expectation) expectation = Object.freeze({ status: order.status });
    const from = String(order.status || '').trim().toLowerCase();
    if (from === to) return { order, unchanged: true };
    if (order.status !== expectation.status) throw conflict('STALE_ORDER_STATUS', 'Trạng thái đơn hàng đã thay đổi. Vui lòng tải lại.');
    if (!canTransitionOrder(from, to, actor)) throw conflict('INVALID_TRANSITION', 'Không thể chuyển trạng thái đơn hàng theo yêu cầu');

    // The expected raw status also preserves compatibility with old uppercase
    // values. This write conflicts with concurrent lifecycle transactions.
    const paymentStatus = to === 'completed' ? PaymentPolicy.completionStatus(order) : undefined;
    const saved = await OrderDAO.transitionStatus(orderId, expectation.status, to, session, actor === 'customer' ? customerId : undefined, paymentStatus);
    if (!saved) throw conflict('STALE_ORDER_STATUS', 'Trạng thái đơn hàng đã thay đổi. Vui lòng tải lại.');
    if (to === 'completed') {
      if (order.stockReserved !== true) await reserve(order.items, session);
      for (const [id, quantity] of inventoryItems(order.items)) {
        if (!await ProductDAO.incrementSold(id, quantity, session)) throw conflict('PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm trong đơn hàng');
      }
    }
    if (to === 'canceled') {
      if (order.stockReserved === true) {
        for (const [id, quantity] of inventoryItems(order.items)) {
          if (!await ProductDAO.releaseStock(id, quantity, session)) throw conflict('PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm trong đơn hàng');
        }
      }
      await releaseVoucher(order.voucherCode, session);
    }
    return { order: saved, unchanged: false };
  });
}
module.exports = { OrderError, errorResponse, transaction, reserveAndCreate, transition };
