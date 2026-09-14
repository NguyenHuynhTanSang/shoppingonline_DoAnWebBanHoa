const DELIVERY_FAILURE_REASONS = Object.freeze([
  'customer_unavailable',
  'address_issue',
  'customer_rescheduled',
  'delivery_issue',
  'other'
]);

const DELIVERY_ATTEMPT_NOTE_LIMIT = 300;
const DELIVERY_ATTEMPT_LIMIT = 20;

module.exports = {
  DELIVERY_FAILURE_REASONS,
  DELIVERY_ATTEMPT_NOTE_LIMIT,
  DELIVERY_ATTEMPT_LIMIT
};