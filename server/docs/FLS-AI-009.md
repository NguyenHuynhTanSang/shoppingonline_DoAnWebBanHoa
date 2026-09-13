# Admin Support Queue

UI: /admin/support-requests, menu AI & Hỗ trợ. Reuses admin layout, Axios and private routes.
API under /api/admin/support-requests:
- GET /: status, category, search (max 100), sort=newest|oldest, page; 25 rows per page.
  Search matches exact support/order/customer IDs or customer name/username (literal regex).
  Global statistics remain independent of filters.
- GET /:id: support detail plus customer name/username/email/phone only.
- PATCH /:id/status: body contains only status=in_progress|resolved.

JWT signature/expiry + admin/staff role required. Backend also verifies account existence and active
staff. assignedTo comes from that account, never the request body. Both operational roles can resolve
an in-progress request. No order/payment mutation or notification occurs.

Schema adds optional assignedTo {id,role,name} to SupportRequest; no backfill or migration.
Old records show Chưa tiếp nhận. Existing timestamps update on transition.
Atomic filter permits only pending→in_progress→resolved; conflicts return 409; malformed input 400,
missing detail 404, unauthorized 401/403, persistence errors 500 without raw errors.

The existing order UI has no individual order URL, so this page displays related order ID without
duplicating order detail logic. Staff can use the existing Orders menu.
No realtime, staff chat, email or customer history added.

Tests use mocked persistence; build validates integration with existing admin routes. Manual browser
and Atlas validation are still required before deployment. Customer name lookup uses a bounded-length
literal search and database timeout but may scan many records on large catalogs.
