# ADMIN-ORDER-006 — Checkout Idempotency & Safe Retry

## Contract

Authenticated `POST /api/customer/checkout` requires `Idempotency-Key` matching
`^[a-zA-Z0-9][a-zA-Z0-9_-]{15,127}$` (16–128 characters). Missing key returns
400 `IDEMPOTENCY_KEY_REQUIRED`; malformed key returns 400 `INVALID_IDEMPOTENCY_KEY`.
Only JWT-authenticated customer identity scopes the key.

The backend hashes explicit normalized intent with SHA-256: customer identity,
sorted product IDs with aggregated positive integer quantities, trimmed/uppercase
voucher code, delivery date/slot, trimmed card message, recipient contact/address/
shop note and payment method. Money, order/payment status and reservation flags
from the client are excluded. Missing contact values are represented as empty
input in the hash, so later profile edits do not change an existing request's hash.
The first order still uses the existing profile fallback rules.

Same key/hash returns the original order with its CURRENT status and stored
pricing, including canceled/completed orders. No price/voucher/product revalidation
or inventory writes occur on replay. Past delivery dates may replay an existing
order; a new order must pass today's date validation. Different valid intent under
a committed key returns 409 `IDEMPOTENCY_KEY_REUSE_CONFLICT`. Malformed inputs return
400 before replay. Failed/aborted checkouts create no permanent key record and are
not cached. Corrected input can be submitted if no order was committed.

Stock reservation, voucher consumption and insertion of order/key/hash share the
existing transaction. A unique-index loser rolls back, looks up the committed
winner by customer/key and compares hashes. Unknown commit acknowledgement follows
the same safe lookup. If no winner is available, a safe error allows the client to
retry the SAME key. There is no sequential transaction fallback or in-memory lock.
The response retains `{success,message,order,pricing}` and omits internal key/hash.

## Client lifecycle

The mounted checkout retains an active key in a ref, generated with browser
`crypto.getRandomValues` (128 random bits). Same normalized payload retries reuse
it after timeout/network/unconfirmed response. Changed submitted intent generates
a new key. Confirmed response containing an order ID clears it. A synchronous
in-flight ref blocks double submit for UX; database uniqueness enforces correctness.
Refreshing/unmounting loses the active key; persistence across refresh is not
implemented. After an uncertain checkout, retry in the same mounted page.

## Required deployment-managed index

Order has optional `checkoutIdempotencyKey` and `checkoutIntentHash` fields, hidden
from ordinary queries. Legacy orders omit them; no migration/backfill is needed.
Order schema alone has `autoIndex: false`. No application `createIndex`,
`createIndexes` or `syncIndexes` path is introduced. Other models are unchanged.

Exact index definition (operator commands below are documentation, NOT run by app):

```javascript
// In mongosh connected to the intended deployment database using operator credentials:
db.orders.getIndexes()
db.orders.createIndex(
  { "customer._id": 1, checkoutIdempotencyKey: 1 },
  {
    name: "checkout_customer_key_unique",
    unique: true,
    partialFilterExpression: { checkoutIdempotencyKey: { $type: "string" } }
  }
)
const index = db.orders.getIndexes().find(i => i.name === "checkout_customer_key_unique")
printjson(index)
```

Before creation, confirm the correct database/collection, inspect existing indexes
and any existing keyed records. Resolve a conflicting index definition or duplicate
keyed data through a separate controlled deployment decision, not automatic deletion.
Verify the exact name, `unique: true`, ordered key pattern above, exact partial
filter above, no sparse option and no collation. Non-default collection collation
is not supported by this readiness contract; do not silently weaken it.

Recommended rollout: create/verify index, then deploy application. Each checkout
performs read-only `listIndexes` verification BEFORE any business mutation. Missing,
wrong or unreadable index yields 503 `CHECKOUT_IDEMPOTENCY_NOT_READY`. No ready state
is cached, so removal is detected on subsequent requests. This costs one metadata
query per checkout/replay. Runtime credentials need permission to list indexes.
Operators must not drop/change the index while checkout requests are in flight:
verification is not a lock against administrative DDL. Quiesce checkout before DDL.

Rollback: retain index and committed key/hash fields. Old orders remain compatible.
Rolling back to pre-006 application removes retry protection and may allow duplicate
orders; stop/drain checkout and resolve uncertain attempts first. Never drop the
index while the new application is serving checkout.

## Validation and limitations

Focused tests exercise strict readiness, required key, sequential/concurrent unique
conflicts, response loss, transaction abort, different intents, customer isolation,
stock/voucher final capacity and terminal-order replay. Existing ORDER-002 through
005B tests remain regression coverage. Backend transaction/uniqueness tests use a
deterministic simulator, not a live MongoDB replica set. Production index creation,
real Mongo concurrency and deployment permissions must be verified operationally.

No production database was accessed or mutated in implementation/tests. No Redis,
queue, payment verification, refund, delivery redesign or legacy migration is added.
