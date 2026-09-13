# FLS-AI-011 — Return to AI

Reuses PATCH /api/admin/support-requests/:id/status with {"status":"resolved"}
and the existing admin action. The atomic update requires in_progress; staff must match
assignedTo.id AND assignedTo.role. Admin retains override permission. JWT/account checks
remain server-side. Repeated, unassigned or stale transitions return 409 without publishing.
Persistence failure returns 500 and leaves the session active.

SupportRequest adds optional resolvedAt (Date) and resolvedBy ({id,role,name}), written in
the same update. Existing records require no migration; no order/payment schema changes.
The persisted status/metadata represent completion; no duplicate SupportMessage is inserted.

Existing support:status {id,status} is published only after a successful database update,
to recipients whose JWT and request permissions are verified. Customer displays a system
notice and automatically returns to AI; human draft and supportContext are cleared.
New messages use POST /api/ai/chat. The existing active-session guard still blocks AI only
while in_progress. Human history is never submitted as AI context.

New authenticated GET /api/support-chat/:id/status returns {request:{id,status}} and uses
the same customer ownership/staff assignment/admin authorization as history. Both chat UIs
poll every 10 seconds (one request in flight, 10-second timeout) and on window focus to
recover lost events. Opening the customer widget also fetches /current; resolved returns
to AI without localStorage dismissal flags. Reconnect reloads history and confirmed status.

Resolved human writes remain rejected by SupportChatService, including direct socket sends
and reconnect; transactions already conditionally lock the in-progress request. History
remains readable. Customer return unmounts the human component, disconnects its socket,
clears polling and removes the focus listener. Admin keeps read-only history and disconnects
its socket on resolution. Status cannot regress when older responses arrive.

## Validation

- Server: node --test server/tests/*.test.js — 25 PASS.
- Customer targeted AIChatComponent/HumanSupportChat tests — 8 PASS.
- Admin targeted SupportQueueComponent/HumanSupportChat tests — 5 PASS.
- npm run build in each client — PASS. Existing admin OrderAdminComponent.js:428 hook
  dependency warning; Browserslist/deprecation notices remain unchanged.
- Full frontend test runs: FAIL in each existing App.test.js because Jest cannot resolve
  react-router-dom. No dependency changes were made for this unrelated test setup issue.

| Ticket case | Result / evidence |
| --- | --- |
| 1 resolve/event/UI | PASS: real REST transition + Socket.IO event; rendered UI tests |
| 2 new AI question | PASS: widget uses /ai/chat without old context; product route test |
| 3 resolved customer send | PASS: socket rejects SESSION_CLOSED |
| 4 resolved admin send | PASS: service rejects SESSION_CLOSED |
| 5 customer refresh | PASS: /current resolved renders AI |
| 6 admin resolved queue | PASS: filter/reload UI test |
| 7 unassigned staff | PASS: real route/DAO rejects 409 |
| 8 repeated resolve | PASS: rejects 409; no system message insert |
| 9 missed event/disconnect | PASS: polling UI and post-resolve reconnect/status fetch |
| 10 new support request | PASS: handoff creation with no open request; DAO excludes resolved |
| 11 product search before/after | PASS: real AI routing with mocked product tool, plus product tests |
| 12 other admin pages | Build PASS; full UI regression NOT VERIFIED (App.test.js failure) |

Tests use synthetic JWTs and mocked MongoDB/provider data. They do not prove real Atlas
transaction concurrency, live Groq availability, or browser multi-tab behavior. Single-instance
realtime deployment limitations from FLS-AI-010 still apply. No .env was read or changed.

## Files changed in this ticket

- server/models/Models.js
- server/models/SupportRequestDAO.js
- server/api/supportChat.js
- server/tests/support-queue.test.js
- server/tests/realtime-chat.test.js
- server/tests/handoff.test.js
- client-customer/src/components/AIChatComponent.js
- client-customer/src/components/AIChatComponent.test.js
- client-customer/src/components/HumanSupportChat.js
- client-customer/src/components/HumanSupportChat.test.js
- client-admin/src/components/HumanSupportChat.js
- client-admin/src/components/HumanSupportChat.test.js
- client-admin/src/pages/SupportQueueComponent.test.js
- server/docs/FLS-AI-011.md

Other pre-existing uncommitted changes are outside this ticket.
