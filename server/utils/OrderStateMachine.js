const ORDER_STATUS = Object.freeze({
  PENDING: 'pending', APPROVED: 'approved', PREPARING: 'preparing',
  DELIVERING: 'delivering', COMPLETED: 'completed', CANCELED: 'canceled'
});
const ALLOWED_TRANSITIONS = Object.freeze({
  pending: Object.freeze(['approved', 'canceled']),
  approved: Object.freeze(['preparing', 'canceled']),
  preparing: Object.freeze(['delivering']),
  delivering: Object.freeze(['completed']),
  completed: Object.freeze([]), canceled: Object.freeze([])
});
function isValidOrderStatus(status) {
  return typeof status === 'string' && Object.values(ORDER_STATUS).includes(status);
}
// Same-state is deliberately NOT a transition. Authorized routes return a
// successful no-op before side effects, including for terminal states.
function canTransitionOrder(from, to, actor) {
  if (!isValidOrderStatus(from) || !isValidOrderStatus(to)) return false;
  if (actor === 'customer') return from === 'pending' && to === 'canceled';
  return (actor === 'admin' || actor === 'staff') && ALLOWED_TRANSITIONS[from].includes(to);
}
module.exports = { ORDER_STATUS, ALLOWED_TRANSITIONS, isValidOrderStatus, canTransitionOrder };
