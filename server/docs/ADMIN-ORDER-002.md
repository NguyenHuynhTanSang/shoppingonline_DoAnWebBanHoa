# Order state machine contract

Backend authority: `utils/OrderStateMachine.js`. Status values are canonical lowercase strings.

Admin/staff: pending -> approved -> preparing -> delivering -> completed.
Cancellation: admin/staff may cancel pending or approved; customers may cancel only their own pending order.
Completed and canceled are terminal. Skips, backwards moves, unknown actors/statuses fail closed.

`canTransitionOrder` describes actual changes, so same-state returns false. After authentication and ownership checks, routes handle same-state separately as HTTP 200, success true, with no save, stock or voucher effects. Repeated customer cancellation of an already canceled order follows this no-op rule.

Admin/staff PUT /api/admin/orders/:id/status: unknown requested status -> 400; disallowed transition -> 409.
Customer PUT /api/customer/orders/:id/cancel: non-pending -> 409, except already canceled -> 200 no-op. Ownership checks remain in place.
Admin UI mirrors the contract for choices; direct requests are always validated on the backend.

## Boundary for ORDER-003

This is validation, not concurrency control. Read/validate/side-effects/save remains non-atomic. Concurrent requests may validate the same old status, repeat stock/voucher effects, or overwrite each other. Sequential retries see the saved state and are no-ops. Completion still uses the existing stock handling and cancellation still uses the existing voucher handling, in the original order. Partial failures remain possible.

Checkout still creates pending orders; no stock reservation is implemented here. ORDER-003 must implement reservation at checkout and atomic stock/status changes with transaction/compensation. The unused OrderDAO.update method remains unchanged and must not be introduced as a route bypass. No schema, payment, refund or production data changes belong to this ticket.
