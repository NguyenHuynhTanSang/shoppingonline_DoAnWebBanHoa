const PAYMENT_METHOD = Object.freeze({ COD: 'cod', BANK: 'bank', MOMO: 'momo' });
const PAYMENT_STATUS = Object.freeze({
  COD_PENDING: 'Chờ thanh toán khi nhận hàng',
  PAID: 'Đã thanh toán',
  DEMO_UNVERIFIED: 'Thanh toán demo - chưa xác minh'
});
const LEGACY_DEMO = 'Đã thanh toán demo';
function isPaymentMethod(method) { return Object.values(PAYMENT_METHOD).includes(method); }
function checkoutStatus(method) {
  if (!isPaymentMethod(method)) throw new Error('Invalid payment method');
  return method === PAYMENT_METHOD.COD ? PAYMENT_STATUS.COD_PENDING : PAYMENT_STATUS.DEMO_UNVERIFIED;
}
function completionStatus(order) {
  const method = order.customerInfo?.paymentMethod;
  if (method === PAYMENT_METHOD.COD) return PAYMENT_STATUS.PAID;
  if (method === PAYMENT_METHOD.BANK || method === PAYMENT_METHOD.MOMO) {
    // Preserve the stored historical value; presentation explains its meaning.
    return order.paymentStatus === LEGACY_DEMO ? LEGACY_DEMO : PAYMENT_STATUS.DEMO_UNVERIFIED;
  }
  return undefined; // Unknown historical methods are not inferred to be COD.
}
function displayStatus(status) {
  return status === LEGACY_DEMO ? `${PAYMENT_STATUS.DEMO_UNVERIFIED} (dữ liệu cũ)` : status;
}
module.exports = { PAYMENT_METHOD, PAYMENT_STATUS, isPaymentMethod, checkoutStatus, completionStatus, displayStatus };
