# FLS-AI-014A — Friendly, focused order replies

OrderStatusService still formats database results deterministically; Groq is not involved.
responseTopics selects total/payment/date/items/status, or all topics for an explicit full
summary. Multiple explicit topics are combined. Default replies prioritize status. Single-order
focused replies omit redundant IDs; multiple results and full summaries include IDs for selection.

Examples using test fixture data:
- Total: “Tổng đơn của bạn là 830.000đ.”
- Payment: recorded payment text plus the known payment method, without inferring settlement.
- Date: vi-VN date/time in Asia/Ho_Chi_Minh, not raw ISO in reply.
- Items: product snapshot names and quantities only; missing values are explicitly unknown.

OrderDAO adds only items.product.name and items.quantity to its existing read projection.
Items are sanitized and bounded to 20 in presentation; larger orders refer users to the existing
order page. Names/quantities come from order snapshots, not current product prices or Groq.
No schema, ownership, query selection, status transition or handoff flow changes.

Existing public order/orders DTO fields remain compatible; items/moreItems are added only when
items or a full summary is requested. The customer-visible reply contains only requested topics.
No raw Mongo/customer document, address, notes or internal metadata is exposed.
Login/error/unsupported-action wording is friendlier. Cancel/refund actions remain unavailable;
customers are directed to the existing staff-request flow, without claiming a transfer occurred.

## Validation

node --test server/tests/*.test.js: 34 PASS.
Customer production build result is recorded in the completion report.
Tests use mocked DB data and existing synthetic JWT/localhost transport fixtures, not live Atlas.

| Ticket case | Result |
| --- | --- |
| 1 latest status, no field dump | PASS |
| 2 referenced total only | PASS |
| 3 payment status/method only | PASS |
| 4 readable Vietnamese date | PASS |
| 5 item names/quantities only | PASS |
| 6 explicit full summary | PASS |
| 7 friendly cancel refusal, no write action | PASS |
| 8 Product Search regression | PASS |
| 9 Conversation Context regression | PASS |
| 10 Human Handoff regression | PASS |

Additional checks cover combined questions and missing total/item data.
The existing limitation remains: recorded paymentStatus is not independent gateway verification.
The presentation parser supports bounded phrase patterns rather than general semantic classification.

## Files changed

- server/services/ai/OrderStatusService.js
- server/models/OrderDAO.js
- server/api/ai.js
- server/tests/order-status.test.js
- server/tests/order-lookup.test.js
- server/docs/FLS-AI-014A.md (new)

No frontend source, dependency, .env, schema or unrelated ticket changes.
