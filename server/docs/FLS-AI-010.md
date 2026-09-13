# Realtime support chat MVP

Socket.IO is attached to the same HTTP server/port as Express. Backend starts listening only after
MongoDB connection and SupportMessage index initialization. Dependencies: socket.io (server),
socket.io-client (both React apps); npm manifests/locks updated, no provider SDK or new infrastructure.
Use npm install/npm ci consistently; npm also updated server/yarn.lock in this workspace.

## Modes and UI

SupportRequest.status is the source of truth: pending = waiting, in_progress = human active,
resolved = closed. Customer widget loads the latest active/latest request on opening; a new handoff
switches it immediately to human UI. Admin opens request detail in AI & Hỗ trợ to see the same chat.
Message history is separate from AI messages; no AI history migration.
Resolved sessions stay read-only. Customer may explicitly start a NEW AI question, which dismisses
the resolved widget locally; this does not reopen, reassign or return the old conversation to AI.

## Authorization

Handshake auth.token contains the existing JWT, not a query-string token. JwtUtil verifies signature
and expiry; the service verifies an existing active account. Roles/IDs are never accepted from event
payloads. Every join/message and every broadcast recipient is checked again against JWT/account/room.
Customers access only their request. Staff access only requests assigned to their ID AND staff role.
Admins retain the broader operational privileges of the existing Support Queue. A room is named
support:<id>; knowing its ID does not confer access. Authorized resolved requests allow history only.
Logout/token replacement on the client requires a new connection; backend expiry/account checks
still apply on every operation. No JWT, headers or handshake is logged or stored in MongoDB.

## Persistence and consistency

New SupportMessage collection: supportRequestId, senderType (customer/staff/admin/system whitelist;
clients may send only their authenticated role), senderId, clientMessageId, message, sequence, createdAt.
SupportRequest adds chatSequence default 0; existing Order/Payment schemas/data are unchanged.
Unique indexes cover (request,senderId,senderType,clientMessageId) and (request,sequence).
Message text: trimmed, 1–2000 chars. Known credential/JWT/OTP/email patterns are redacted with the
existing handoff sanitizer; arbitrary sensitive free text cannot be perfectly identified.

Sending runs in a MongoDB transaction. It conditionally increments the in-progress request's
chatSequence with ownership constraints, checks idempotency, inserts, commits, then broadcasts.
Resolve touches the same request document, so concurrent send/resolve writes conflict and recheck
state on transaction retry. Atlas supports transactions; standalone MongoDB without replica-set
transactions is unsupported. Tests simulate persistence, not real Atlas transaction behavior.
Retries with the same clientMessageId return the stored message. Client keeps that ID on ack timeout;
merge by persisted ID prevents duplicate display. Sequence gaps on retries are harmless.
No optimistic broadcast or automatic offline queue; disconnected sends are disabled.

## REST and events

Authenticated REST (shared across roles):
- GET /api/support-chat/current — customer only; active request preferred, otherwise latest request.
- GET /api/support-chat/:id/messages?before=<sequence> — authorized room, newest 50 in chronological
  order; hasMore and older-page cursor; no unbounded history download.

Events with acknowledgements:
- support:join {supportRequestId} → {ok,request} or {ok:false,code}
- support:message {supportRequestId,message,clientMessageId} → {ok,message} after persistence
- support:message:new {supportRequestId,message} — authorized room recipients
- support:status {id,status} — acceptance/resolution
- support:error {code} — permission lost; no raw errors or stacks

60 join/send operations per actor/minute and 60 authenticated connection attempts per actor/minute;
12 KB maximum Socket.IO payload. Per-process rate counters expire after a minute. This is a single
backend-instance MVP. Multi-instance deployment needs a shared Socket.IO adapter/rate-limit store
and is not implemented here. REST history is bounded but has no distributed throttle.

POST /api/ai/chat checks authenticated customer's active support before any AI/product/handoff path,
and rechecks before releasing an AI response. Active sessions return human_active and supportRequestId,
never Groq output. The widget routes human sends through Socket.IO. No order/payment/stock operations.

## Validation

node --test server/tests/*.test.js
Customer: npm test -- --watchAll=false --runInBand --runTestsByPath src/components/AIChatComponent.test.js src/components/HumanSupportChat.test.js
Admin: npm test -- --watchAll=false --runInBand --runTestsByPath src/pages/SupportQueueComponent.test.js src/components/HumanSupportChat.test.js
Build each frontend with npm run build.

Socket tests use actual localhost Socket.IO server/clients and signed synthetic JWTs with mocked DB:
two-way messages, unauthorized rooms, role spoofing, validation, duplicate retry, status events,
reconnect/history, rate limit, resolved rejection, AI suppression. UI tests render HTML as literal text,
restore history after reconnect and disable sends on disconnect/resolution. Existing product and
handoff tests cover AI/waiting and post-resolved AI building blocks. Real browser multi-tab/mobile
and Atlas transaction/index verification remain deployment checks, not claimed as completed tests.
