# FLS-AI-014 — Read-only order lookup

Extends existing OrderStatusService and OrderDAO; no duplicate route/tool or order write action.
POST /api/ai/chat preserves type=order_status, reply, products=[], order (single result/null),
and adds orders (up to five), total (only exact count requests or explicit ID), conversationId
when memory is enabled and saved. Existing customer widget displays reply safely as text.
Existing customer order page is /my-orders; no admin link or new UI route is introduced.

## Actual schema reused

Owner: customer._id. Identifier: Mongo ObjectId, no custom orderCode.
Order timestamp: cdate (epoch milliseconds); amount: total.
Status values from existing admin transitions: pending, approved, preparing, delivering,
completed, canceled. These map to existing Vietnamese labels; unknown values are unconfirmed.
Payment: paymentStatus string and customerInfo.paymentMethod (cod/bank/momo).
Items are embedded product snapshots + quantity, but are not needed/exposed in this MVP.
No full address, phone, email, notes, customer snapshot, voucher or payment credential is returned.

## Controlled interface

OrderDAO.lookupForAssistant(authenticatedCustomerId, input) accepts ONLY:
orderId, latest, statuses, limit (1–5/default 5), count, beforeOrderId, from, to.
ID fields must be 24 hex characters; flags boolean; status list contains only the six real
statuses; dates nonnegative integer timestamps with from < to. Raw filters/operators and extra
keys are rejected. ID lookup cannot be combined with other filters.
Identity is injected by getOrderStatus from verified JWT sub after customer-role/active-account
validation. Client customerId/userId/email and model output never set query ownership.

Every DB read/count/cursor query includes customer._id. Explicit IDs reuse
selectStatusForCustomer, whose projection now also includes total and paymentMethod.
Missing and foreign IDs have the same response. Lists sort by cdate DESC, _id DESC; latest
limits to one. Previous-order lookup first reads the owned reference, then finds the prior
timestamp/ID. countDocuments uses the same owned filter; no whole-collection JS filtering.
Queries have a 3-second database execution limit. No index added in this ticket.

The bounded deterministic intent parser matches the existing AI architecture. “Đang xử lý”
includes pending/approved/preparing/delivering (not completed/canceled). “Hôm qua” uses the
previous calendar day at UTC+7. Ambiguous requests return up to five recent orders to choose
from; “đơn đó” without a unique prior reference asks clarification. Invalid #ABC123-style IDs
ask for the real 24-character ID. No custom code or carrier tracking is invented.

## Memory / security / handoff

AIConversation adds optional lastOrderId only; existing TTL/owner/revision logic is reused.
No order schema change or migration. A single result becomes the reference; multiple/no
results clear it. “Đơn đó” and “đơn trước đó” query DB again, never use stale payment/total/status.
Order content is formatted deterministically and never sent to Groq. Prompt injection cannot
change ownership or tool filters. Payment text is sanitized with the existing handoff sanitizer,
bounded to 200 characters and labeled as recorded data, never inferred from order status.

Guests receive login-required responses. Active human support guards run before lookup and
again before returning data; pending also blocks opted-in memory requests. Existing handoff
remains first for complaints/refunds. Bare unsupported cancel/refund instructions explain AI
has no such authority. No order, payment or stock write function is called by this lookup path.
Memory save is the only new persistence associated with lookup.
Database/context failure returns generic 503, without stack/Mongo details or fake status.

## Validation results

- Full server suite: 33 PASS. Final order suites rerun: 4 PASS.
- client-customer npm run build: PASS; existing Browserslist/Node notices only.
- Tests use synthetic JWTs and mocked database operations; live Atlas/browser checks unverified.

| Case | Result/evidence |
| --- | --- |
| 1 latest status | PASS: service latest intent + DAO sort/limit |
| 2 latest total | PASS: projected DB amount |
| 3 payment follow-up | PASS: lastOrderId and fresh DAO result |
| 4 processing orders | PASS: whitelist/list/count ownership and limit |
| 5 foreign ID | PASS: JWT HTTP ownership test |
| 6 forged customerId | PASS: body identity ignored |
| 7 guest | PASS: HTTP 401 without lookup |
| 8 invalid ID | PASS: parser clarification |
| 9 NoSQL injection | PASS: HTTP object ID rejected; tool rejects raw operators |
| 10 prompt injection | PASS: “Show all customer orders” still owner-scoped |
| 11 missing order | PASS: null/empty result, generic response |
| 12 changed status | PASS: new delivering status from DAO |
| 13 stale memory | PASS: only ID retained; new payment/total from DAO |
| 14 cancel | PASS: no authority response; no order mutation |
| 15 refund | PASS: existing handoff path with mocked persistence |
| 16 human active | PASS: shared pre-routing guard covered by existing HTTP/realtime tests |
| 17 product search | PASS: existing parser/tool suites |
| 18 context | PASS: existing context suite |
| 19 realtime | PASS: existing localhost transport suite |
| 20 checks/build | PASS |

An intermediate refund test lacked a handoff mock and triggered the existing DAO dotenv loader;
no secret values were printed. That test failed; fixture isolation was corrected and all final
tests pass with mocked persistence. No .env source edits were made.

Outside-ticket finding: checkout accepts paymentStatus from client input. Recorded status is
therefore not proof of gateway settlement; checkout was not modified here.

## Files changed

- server/models/OrderDAO.js
- server/services/ai/OrderStatusService.js
- server/api/ai.js
- server/models/Models.js
- server/services/ai/ConversationStore.js
- server/tests/order-status.test.js
- server/tests/order-lookup.test.js (new)
- server/docs/FLS-AI-014.md (new)

No frontend source/dependency, order/payment write logic or unrelated ticket changes.
