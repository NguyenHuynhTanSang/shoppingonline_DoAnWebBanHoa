# FLS-AI-007

POST /api/ai/chat with `{ "message": "Trạng thái đơn 0123456789abcdef01234567" }`.
Use the existing Authorization Bearer or x-access-token header. JwtUtil verifies the signature and
expiry. Only role customer with a valid sub and an active existing customer can query.
Body customerId/orderId fields are never used; one full order ID is extracted from the message.
Both order ID and authenticated customer ID are required in the same database query.

Response: `{ reply, type: "order_status", products: [], order }`. Order has only id, status
(Vietnamese label), placedAt (ISO UTC or null), paymentStatus (stored value or null).
No address, phone, customer snapshot, total, items, or payment account is exposed.
Foreign and nonexistent orders return the same message with order null. Missing/ambiguous IDs
request one full ID; no automatic order listing. Invalid JWT returns 401/auth_required, unauthorized
or inactive customer returns 403, lookup failures return 503 with no database details.

FAQ remains public. Intent detection is deterministic and limited to order-query phrases or a full
order ID; no LLM runs. All order actions are unavailable; even an action request containing an ID
can only read status. Payment status is the stored value, not external confirmation of payment.
Existing checkout demo behavior is unchanged. No schema/dependency changes.

Tests mock persistence and JWT configuration without loading secrets or connecting to Atlas.
