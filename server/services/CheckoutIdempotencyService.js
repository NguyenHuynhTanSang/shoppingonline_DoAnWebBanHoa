const crypto = require('crypto');
const OrderDAO = require('../models/OrderDAO');
const { OrderError } = require('./OrderLifecycleService');
const { validateDelivery } = require('../utils/DeliveryValidation');
const PaymentPolicy = require('../utils/PaymentPolicy');

const INDEX_NAME = 'checkout_customer_key_unique';
const INDEX_KEY = { 'customer._id': 1, checkoutIdempotencyKey: 1 };
const PARTIAL_FILTER = { checkoutIdempotencyKey: { $type: 'string' } };
function validIndex(index) {
  return index.name === INDEX_NAME && index.unique === true && !index.sparse &&
    !index.collation && JSON.stringify(index.key) === JSON.stringify(INDEX_KEY) &&
    JSON.stringify(index.partialFilterExpression) === JSON.stringify(PARTIAL_FILTER);
}
async function assertReady() {
  // Deliberately uncached: index removal cannot leave a stale ready flag.
  try {
    if ((await OrderDAO.checkoutIndexes()).some(validIndex)) return;
  } catch (_) { /* Safe readiness error; no driver details. */ }
  throw new OrderError(503, 'CHECKOUT_IDEMPOTENCY_NOT_READY', 'Checkout is temporarily unavailable. Please retry later.');
}
function prepare(key, body, customerId) {
  if (key === undefined) throw new OrderError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required.');
  if (typeof key !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{15,127}$/.test(key)) {
    throw new OrderError(400, 'INVALID_IDEMPOTENCY_KEY', 'Invalid Idempotency-Key.');
  }
  const invalid = () => new OrderError(400, 'INVALID_CHECKOUT_INTENT', 'Invalid checkout input.');
  // A committed checkout can replay after its delivery date has passed.
  // New checkout still runs the current-date validation in the route.
  const delivery = validateDelivery(body, new Date(0));
  if (delivery.message) throw invalid();
  if (!Array.isArray(body.items) || !body.items.length) throw invalid();
  const quantities = new Map();
  for (const item of body.items) {
    if (!Number.isSafeInteger(item?.quantity) || item.quantity <= 0) {
      throw new OrderError(400, 'INVALID_QUANTITY', 'Invalid item quantity');
    }
    const id = item?._id || item?.id || item?.productId || item?.product?._id;
    if (typeof id !== 'string' || !/^[a-f0-9]{24}$/i.test(id.trim()) ||
        !Number.isSafeInteger(item.quantity) || item.quantity <= 0) throw invalid();
    const normalizedId = id.trim().toLowerCase();
    const quantity = (quantities.get(normalizedId) || 0) + item.quantity;
    if (!Number.isSafeInteger(quantity)) throw invalid();
    quantities.set(normalizedId, quantity);
  }
  const source = body.customerInfo ?? {};
  if (typeof source !== 'object' || Array.isArray(source)) throw invalid();
  const contact = {};
  for (const field of ['fullName', 'phone', 'email', 'address', 'note']) {
    if (source[field] !== undefined && typeof source[field] !== 'string') throw invalid();
    contact[field] = (source[field] || '').trim();
  }
  contact.email = contact.email.toLowerCase();
  contact.paymentMethod = source.paymentMethod ?? 'cod';
  if (!PaymentPolicy.isPaymentMethod(contact.paymentMethod)) throw invalid();
  if (body.voucherCode !== undefined && typeof body.voucherCode !== 'string') throw invalid();
  const intent = { customer: String(customerId), items: [...quantities].sort((a, b) => a[0].localeCompare(b[0])),
    voucherCode: (body.voucherCode || '').trim().toUpperCase(), ...delivery.value, customerInfo: contact };
  return { customerId, key, hash: crypto.createHash('sha256').update(JSON.stringify(intent)).digest('hex') };
}
async function find(attempt, session) {
  const order = await OrderDAO.selectCheckout(attempt.customerId, attempt.key, session);
  if (order && order.checkoutIntentHash !== attempt.hash) {
    throw new OrderError(409, 'IDEMPOTENCY_KEY_REUSE_CONFLICT', 'Idempotency-Key belongs to a different checkout.');
  }
  return order;
}
function response(order) {
  const plain = order.toObject ? order.toObject() : { ...order };
  delete plain.checkoutIdempotencyKey;
  delete plain.checkoutIntentHash;
  return { success: true, message: 'Đặt hàng thành công', order: plain,
    pricing: { subtotal: order.subtotal, discount: order.discount, shippingFee: order.shippingFee, total: order.total } };
}
module.exports = { INDEX_NAME, INDEX_KEY, PARTIAL_FILTER, validIndex, assertReady, prepare, find, response };
