# ADMIN-ORDER-003: transactional inventory lifecycle

## Compatibility and schema

`Order.stockReserved` is Boolean, default false. No migration or backfill runs.
Missing/false means legacy unreserved inventory. True records that inventory was
reserved by the new checkout. It remains true on terminal orders as historical
provenance; terminal status prevents another release/completion. Clients cannot
set it through checkout: the lifecycle service explicitly writes true only after
successful reservation within the same transaction as order creation.

| Operation | New reserved order | Legacy missing/false |
| --- | --- | --- |
| Checkout | stock -= quantity; create pending, true | No new checkout uses legacy mode |
| Cancel | stock += quantity | No stock change |
| Complete | sold += quantity; no stock deduction | stock -= quantity and sold += quantity |

Both modes use the ORDER-002 matrix. Same-state is success with no writes.
Customer ownership is checked before no-op/transition, and included in the
conditional status write. Admin/staff middleware remains unchanged.

## Transaction boundaries

`OrderLifecycleService.transaction` uses the installed Mongo driver through
`mongoose.startSession()` and `session.withTransaction()`, with snapshot reads,
majority writes and primary read preference. No sequential fallback exists.

Checkout validates input, then reads product snapshots and voucher data within
the session. Existing pricing, discounts, delivery and shipping calculations are
reused. Duplicate product lines are aggregated for inventory writes. Each stock
reservation uses `_id` and `stock: {$gte: quantity}` with `$inc: {stock: -quantity}`.
Every reservation, pending order insert and existing voucher usage increment
shares the session. A failed item/insert/write aborts the unit.

Transitions read the order in the session, validate policy, then conditionally
write with `{_id, status: expectedRawStatus}` before inventory writes. Mongo write
conflicts cause the driver to retry the callback, rereading committed state. A
retry observing the requested terminal status performs no writes. A zero-match
status update returns conflict. Stock/sold/voucher writes share this transaction.
Operations inside a callback run sequentially, without Promise.all.

`ProductDAO.completeSale` no longer performs read-modify-save or deducts stock;
the production lifecycle uses reserveStock/releaseStock/incrementSold. Other
Product CRUD is unchanged. Unused `OrderDAO.update` is not a production path and
must not be introduced as a bypass of the lifecycle service.

## Responses and retry boundaries

- 400: invalid input/status/order ID.
- 403/404: existing ownership/access or missing-order handling.
- 409: insufficient inventory/missing product, stale status, forbidden transition.
- 503 `ORDER_TRANSACTION_FAILED`: driver/transaction failure, generic response
  and generic operational log; no raw driver error/stack is exposed.

Only the driver's built-in transaction/commit retries are used. Callback state
is rebuilt each retry. No HTTP response, email, or external side effect occurs
inside the callback. Abort rolls back all its writes. An exhausted uncertain
commit response does NOT prove that nothing committed: a network failure can
leave the caller uncertain. No checkout idempotency key was added, so an external
checkout retry after an uncertain outcome may create another order if stock is
available. Terminal transition retries remain idempotent through persisted status.

## Voucher and other writers

The existing voucher validation and usage increments/decrements participate in
the session; their calculation and eligibility rules are not redesigned. No
ledger, per-customer usage rule, payment/refund handling or checkout idempotency
was added. Voucher administrative edits/deletions and historical usedCount
consistency remain separate concerns. Existing manual absolute stock/product
edits can still overwrite inventory values; this ticket does not redesign those
writers or claim inventory correctness against unrelated administrative resets.

## Deployment and validation limitations

Repository bootstrap builds a MongoDB SRV URI with retryWrites and majority
writes; Support Chat already uses withTransaction. These establish intended
usage, not proof of the active deployment's topology/permissions. No credentials
or .env contents were read to discover deployment addresses. No database was
contacted for these tests. No mongod/mongosh executable was found in PATH.

A transaction-capable replica set/sharded test deployment is needed to verify
real write conflicts, aborts, retries and commit ambiguity before rollout. A
standalone MongoDB deployment is unsupported and operations fail safely without
non-transactional writes. Do not run test seeds/migrations against production.

`tests/helpers/order-store.js` simulates snapshot transactions and optimistic
commit conflicts in memory. It executes the real DAO/service/routes, asserts
session usage and tests rollback/concurrency, but does not prove MongoDB server
transaction behavior. Focused coverage includes stock=1 HTTP concurrency,
multi-product shortage/insert rollback, legacy/new completion and cancellation,
duplicate/concurrent transitions, sold-write failure, stale status, ownership,
full transition matrix, checkout pricing/shipping/voucher and safe failure output.

ORDER-004 follow-up: checkout idempotency/reconciliation for uncertain outcomes,
voucher lifecycle review, and integration validation on an isolated replica set.
