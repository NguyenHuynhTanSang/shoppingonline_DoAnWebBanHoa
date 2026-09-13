# ADMIN-ORDER-005B — Payment / Order Consistency

## Canonical policy

`utils/PaymentPolicy.js` owns backend payment method/status rules. Checkout accepts
`cod`, `bank`, or `momo`; the existing missing/null method default remains COD.
Client payment status is never authoritative.

| Method | Checkout | Valid completion |
| --- | --- | --- |
| COD | Chờ thanh toán khi nhận hàng | Đã thanh toán |
| Bank / MoMo | Thanh toán demo - chưa xác minh | Remains demo/unverified |

COD completion is a business rule, not evidence from a payment gateway.
Bank/MoMo acknowledgement and QR presentation are simulations, not verification.

## Writes and atomicity

Customer checkout assigns the initial status on the server. OrderLifecycleService
derives completion payment status and passes it to OrderDAO.transitionStatus.
The expected-status conditional update writes order status and payment status
together inside the existing inventory transaction. Failure rolls back both and
inventory changes. Unsupported transactions fail safely without sequential fallback.
Same-state retries do not write or repeat inventory effects. Cancellation preserves
payment status and does not issue a refund.

## Legacy compatibility

The stored value `Đã thanh toán demo` remains readable and is preserved on legacy
demo completion. Admin, customer history and AI order lookup display it as
`Thanh toán demo - chưa xác minh (dữ liệu cũ)`. There is no migration or strict enum.
Historical orders without a known payment method retain payment status rather than
being inferred to be COD. Already completed orders are not retroactively updated.

## Validation and limits

Focused tests cover checkout tampering, methods, COD/demo completion, cancellation,
duplicate/concurrent transitions, rollback and legacy presentation. Existing order
state, inventory, cancellation, voucher and AI lookup tests also run. Backend tests
use the transaction store simulator, not a live MongoDB deployment. React tests
cover admin display, demo acknowledgement and customer history.

No real gateway, webhook verification, refund, reconciliation, or new checkout
idempotency mechanism is implemented. ORDER-006 remains a separate follow-up.
