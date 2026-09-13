# ADMIN-ORDER-005A: voucher consume and amount integrity

## Existing semantics retained

Voucher fields are the existing code/name/description, type/value, minOrderValue,
maxDiscount, startDate/endDate, usageLimit/usedCount, isActive and timestamps.
No field or migration is added. Code normalization remains trim + uppercase.
usageLimit 0/null/missing means unlimited; a positive limit caps usage. Missing
usedCount is treated as zero and the first $inc initializes it. Invalid counters
(negative, fractional, null, unsafe integer) fail closed without reconciliation.

Fixed discounts are capped at subtotal. Percent discounts are floored, respect
positive maxDiscount, then capped at subtotal. Existing product discount logic
is reused. Shipping remains 30,000 below subtotal 1,500,000 and zero at/above it,
based on subtotal before voucher discount. Total is max(subtotal-discount+shipping,0).

## Transaction and conditional consume

ORDER-003 already placed checkout writes in one transaction. This ticket replaces
the unchecked voucher-ID increment with an explicit conditional consume and
moves it before Order insertion. Product and voucher reads, reservations, consume,
and pending Order insert all use the same session. No sequential fallback exists.

The consume filter uses validated voucher _id, isActive=true, the observed counter
and usedCount < validated finite limit. Unlimited vouchers still have a safe integer
overflow guard. The missing-counter branch is permitted only when observed count
is zero, which is below a valid positive limit. Voucher rule/limit changes conflict
with the transactional write and retry revalidates fresh rules and product data.

No-match consume throws 409 VOUCHER_USAGE_CONFLICT. The losing final-slot checkout
leaves no order or reserved inventory. Failure after consume, including insert
failure, aborts the counter and inventory updates. Driver retry is reused, without
external effects in the callback. Unsupported transactions fail safely.

If an explicitly applied voucher is unavailable on a subsequent callback attempt,
checkout fails with 409; it never drops the voucher and commits full price. Initial
missing/inactive/expired/not-started/minimum/type/value rejection remains 400
INVALID_VOUCHER; exhausted/inconsistent usage is 409 VOUCHER_USAGE_CONFLICT.
Inventory conflicts remain 409 INSUFFICIENT_STOCK; infrastructure errors remain
503 ORDER_TRANSACTION_FAILED, without raw errors or stack traces.

## Amount/input integrity

Checkout quantity must be a positive safe integer number, without string/boolean
coercion. No arbitrary business maximum is added. Invalid quantities produce 400
INVALID_QUANTITY before transactional writes. Non-finite canonical prices,
subtotal/discount/shipping/total produce 400 INVALID_AMOUNTS. Client unit price,
subtotal, discount, shippingFee, total, status, paymentStatus and stockReserved do
not control persisted values. The existing product and monetary snapshots remain.

Voucher preview/apply can still accept a client subtotal if items are absent.
It neither consumes usage nor authorizes a later checkout amount. Preview is not
a guarantee of availability, stock or final price; checkout independently recomputes.

## Validation and remaining boundaries

Voucher HTTP tests execute real routes/service/DAOs with the existing in-memory
transaction simulator: 1/0 and 10/9 final-slot races, scarce stock plus voucher,
consume conflict/write failure, order insert/commit rollback, voucher invalidation
between attempts, fixed/percent caps, shipping threshold, tampered amounts, invalid
quantity, arithmetic overflow, unlimited/no-voucher and cancellation compatibility.
ORDER-002/003/004 regression retains immutable transition expectations and one-time
cancellation release. These are not live MongoDB transaction/concurrency tests.

Deployment topology has not been verified against a running database. Real abort,
write conflict and commit uncertainty need an isolated transaction-capable MongoDB
test deployment. No production database is read/written by the test harness.
An uncertain commit error does not prove rollback; an external checkout retry may
create another order when resources permit. Checkout idempotency is ORDER-006.

Bank/MoMo still use the existing paid-demo label; no real payment correctness is
claimed (ORDER-005B). Voucher deletion/recreation by code, administrative counter
edits and historical inconsistent usage remain outside scope. No ledger, refund,
per-customer usage policy, reconciliation, payment gateway or migration is added.
