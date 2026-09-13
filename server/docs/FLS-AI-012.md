# FLS-AI-012 — Operator support notifications

## Behavior and contract

Reuses Socket.IO on the existing server and GET /api/admin/support-requests?status=pending&page=1.
The existing global stats.pending is the badge source; no new API, schema or dependency.
Admin/staff can already read the support queue under its existing JWT/account checks.

Backend joins authenticated admin and active staff sockets to support-admins automatically.
Client role/room fields are ignored. No arbitrary join or client notification relay handler exists.
Before each notification, JWT expiry/signature and current account/role are checked again;
unauthorized sockets leave the notification room. Customer sockets never join this room.

Events:
- support:new {supportRequestId,status:"pending",category}: only after successful handoff insert.
  Reusing an existing open request or a failed insert does not publish.
- support:updated {supportRequestId,status}: after a committed acceptance/resolution.
- Existing support:status remains unchanged for customer return-to-AI and human chat.

Payloads are explicitly projected; no name, email, phone, message, raw document or credential.
Notification transport failure does not misreport a successful DB mutation as failed.

Admin layout owns one notification socket and one listener per event. Re-renders do not create
connections. HumanSupportChat keeps its existing separate session socket so resolving/unmounting
chat does not disconnect notifications. Layout unmount removes listeners/focus handler, cancels
the REST request/timer and disconnects its notification socket. Login pages have no admin layout.

Initial load, reconnect, events, window focus and a 30-second fallback poll refetch existing REST
statistics. Reads have a 10-second timeout, at most one in flight, and rerun if an event arrived
during a prior read. Failed reads keep the last confirmed badge rather than inventing a count.
The queue refetches its filtered rows/statistics on the local refresh signal; aborted older queue
responses cannot replace current results. Events never increment/decrement a local counter.

Sidebar shows a badge only for pending > 0. One compact in-flow banner announces a new request,
with Close and View links to the existing support queue route. JSX renders text safely. Multiple
arrivals replace the banner; IDs are deduplicated within the layout lifetime (bounded to 500).
Reconnect does not reset listeners/dedup. This is not notification history or offline event replay.

## Validation

- node --test server/tests/*.test.js: 26 PASS. Extended support-queue test rerun: 2 PASS.
- Admin SupportNotifications, SupportQueueComponent, HumanSupportChat: 8 PASS.
- Customer AIChatComponent, HumanSupportChat: 8 PASS.
- client-admin npm run build: PASS with existing OrderAdminComponent.js:428 hook warning,
  Browserslist age and Node deprecation notices. No dependency updates attempted.

| Ticket case | Result and evidence |
| --- | --- |
| 1 new request notification/badge | PASS: handoff post-save publish test, real socket delivery, rendered badge test |
| 2 acceptance counts | PASS: API transition publishes after save; UI refetch replaces pending count |
| 3 resolution counts | PASS: transition event and queue statistic refresh tests |
| 4 refresh | PASS: initial REST count rendered |
| 5 requests while offline | PASS: initial load uses nonzero API count, not event history |
| 6 customer room join | PASS: absent from operator room; support:join rejects room name |
| 7 fake admin role | PASS: forged JWT rejected; handshake role ignored |
| 8 duplicate notification | PASS: repeated ID does not reopen dismissed banner; one listener |
| 9 two admins online | PASS: real sockets both receive new/update events; UI count refresh tested separately |
| 10 reconnect | PASS: connect callback refetches count; listener/socket count unchanged |
| 11 DB create failure | PASS: handoff failure emits no additional notification |
| 12 existing human chat | PASS: real transport regression and both client chat tests |
| 13 product search | PASS: server product tests and customer AI tests |

These are automated component/service/transport tests using synthetic JWTs and mocked DB data,
not a browser-to-Atlas end-to-end run. Live multiple-browser checks remain unverified. Existing
single-backend-instance limitation remains: multiple instances need a shared Socket.IO adapter.
REST fallback eventually repairs counts when a notification is lost; it does not recreate banners.
The existing App.test.js router-resolution issue from FLS-AI-011 was not modified or rerun here.

## Files changed only for this ticket

- server/realtime/supportChat.js
- server/services/ai/HandoffService.js
- server/api/support.js
- server/tests/handoff.test.js
- server/tests/support-queue.test.js
- server/tests/support-notifications.test.js (new)
- client-admin/src/components/LayoutComponent.js
- client-admin/src/components/SidebarComponent.js
- client-admin/src/pages/SupportQueueComponent.js
- client-admin/src/services/useSupportNotifications.js (new)
- client-admin/src/components/SupportNotifications.test.js (new)
- client-admin/src/pages/SupportQueueComponent.test.js
- server/docs/FLS-AI-012.md (new)

No customer source, MongoDB schema, order/payment logic, dependency or .env changes.
Pre-existing uncommitted work is preserved.
