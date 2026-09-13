# ADMIN-ORDER-004: cancellation and voucher release

## Canonical operation

Both existing routes call `OrderLifecycleService.transition`:

- Customer PUT `/api/customer/orders/:id/cancel`: own pending order only.
- Admin/staff PUT `/api/admin/orders/:id/status`: pending/approved may cancel.

ORDER-002 policy, authorization and ORDER-003 transactions are reused. There is
no new endpoint, schema or frontend change. Same-state returns success before
any status/inventory/voucher write, after ownership checks.

Cancellation conditionally writes `{_id, status: expectedStatus}` (plus
`customer._id` for customer), restores stock only when `stockReserved === true`,
then releases the voucher, all with the same session. Missing/false legacy flags
never restock. Commit makes the operation visible as a unit.

## Voucher release and inconsistent data

Voucher consume currently occurs in `api/customer.js` checkout, inside the
ORDER-003 transaction. This ticket does not change that code or its rules.
Release occurs only in the successful cancellation branch of the lifecycle.

No voucherCode means no release operation. Otherwise the voucher is found by
the existing normalized code within the transaction. `usedCount` must be a safe
integer >= 1. The decrement uses the voucher's `_id` and exact observed usedCount
as a conditional filter with `$inc: {usedCount: -1}`. It cannot reduce a valid
counter below zero. Inactive/expired vouchers can still be released.

Missing voucher, missing/zero/negative/fractional/invalid counter, or zero-match
decrement returns HTTP 409 `VOUCHER_RELEASE_CONFLICT`. The entire cancellation
rolls back, including stock restoration and status change. No counter is guessed,
clamped, reconciled, or repaired. Existing negative values remain untouched.
This deliberately means an active order with inconsistent voucher data cannot
be canceled until that inconsistency is addressed separately.

If already canceled, return the committed state without touching voucher data,
even if the voucher has subsequently been removed. This prevents a repeated
cancel from trying to release a counter which is now zero.

## Concurrency and retries

The conditional order write plus Mongo transaction conflicts serialize competing
operations. Each request freezes its first observed raw FROM status outside the
retry callback's local state and reuses it for every conditional write. Retry
may reread current state but cannot adopt a new FROM: a mismatch returns 409
STALE_ORDER_STATUS before any retry writes, unless current state equals the
target (idempotent no-op). Duplicate cancellations
yield one actual change and a no-op; duplicate completion never adds sold again.

Pending approval racing customer cancellation admits one valid final result;
customer cancellation cannot retry from approved. The same immutable expectation
applies to admin/staff: concurrent requests both observing pending cannot commit
approval then reinterpret cancellation as approved -> canceled. One wins and
one receives conflict. A separate new request first observing approved may
still cancel under the existing policy; no client expected-status field is added.
Delivering -> canceled remains forbidden, including races with completion.

If commit succeeds but acknowledgement is lost, an external retry reads canceled
and does nothing. If commit aborts before persistence, no part is kept. Uncertain
commit errors do not prove rollback; the existing 503 response remains generic
and retry uses persisted state. No external side effects run in the callback.

## Testing and runtime limitation

`tests/order-cancellation.test.js` executes the real service/DAO and HTTP routes
against the ORDER-003 in-memory transaction simulator. Tests cover reserved and
legacy cancellation, voucher release, duplicates, concurrency, callback retry,
lost commit acknowledgement, competing approval, shared-voucher underflow,
missing/inconsistent counters, ownership and rollback at stock/voucher/status/
commit failures. Existing ORDER-002 matrix and ORDER-003 inventory/checkout tests
remain regression coverage.

The simulator's injected commit faults are not live network or MongoDB tests.
Real replica-set/sharded transaction behavior still requires an isolated test
deployment. Runtime transaction failure/unsupported topology has no sequential
fallback. No production database was contacted or changed for these tests.

## Remaining voucher boundary

This secures release, not the whole voucher lifecycle. Orders still identify
vouchers by code; deletion/recreation of the same code and historical consumption
cannot be disambiguated without a stronger voucher contract. Positive usedCount
does not prove which historical order consumed a use. Checkout consumption rules,
administrative counter edits, ledger/reconciliation, idempotency keys, payment and
refund behavior are unchanged. ORDER-005/006 should address those boundaries and
real-database integration validation. No migration or reconciliation job is added.
