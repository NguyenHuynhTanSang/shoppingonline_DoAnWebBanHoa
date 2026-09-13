# Human handoff MVP

Existing POST /api/ai/chat detects complaints before FAQ/product/order routing. JWT verification
and an active customer account are required. Guests are asked to log in; no anonymous orphan tickets.
No body customerId is trusted. Order-related complaints require one full order ID owned by the
authenticated customer using OrderDAO.selectStatusForCustomer. Staff requests may omit order ID.

New collection supportrequests: customerId (ObjectId, required), orderId (ObjectId/null), category
(enum), customerMessage (redacted, max 2000), status (pending/in_progress/resolved),
source (ai_chat), createdAt/updatedAt (Mongoose timestamps), generated _id. Existing records are not
backfilled; added fields appear on new records. Category names remain compatible with the previous MVP.
No existing Order/Payment schema or data is modified. Model registration follows Models.js conventions.
Common credentials, long numeric sequences and email addresses are redacted; free text redaction
is not comprehensive semantic PII detection. No conversation history or customer snapshot is stored.

Response includes reply, type=human_handoff, products=[], needsHumanSupport=true,
supportRequestId (null until a successful insert or verified existing open request).
Missing information returns type=human_handoff_required and includes supportContext,
which the widget echoes with the next message. Context is untrusted text, revalidated on backend;
it never supplies identity or bypasses order verification. The user can stop the pending request.
Wrong/foreign orders share one response. Save errors return 503 and explicitly state failure.

Only persistence is implemented: no staff notification, dashboard, promised response time, refund,
cancel or order mutation. Before insertion the DAO reuses an open pending/in_progress request for the
same customer/order/category. This prevents sequential duplicates but is not atomic: simultaneous
requests can still race. No unique index or migration is added; staff workflow remains outside this MVP.
Detection uses bounded keyword
rules rather than Groq; no user complaint or account data is sent to Groq through this path.

Tests use mocked persistence, no Atlas writes or environment-file reads. Restart backend to register
the new model and route behavior. No data migration is required for existing collections.
