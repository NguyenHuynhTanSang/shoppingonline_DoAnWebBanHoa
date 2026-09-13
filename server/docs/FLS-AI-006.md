# FLS-AI-006

POST /api/ai/chat accepts `{ "message": "Phí giao hàng bao nhiêu?" }` and returns
`{ "reply": "...", "type": "faq", "products": [] }`. Invalid/missing/blank messages or
messages over 2000 characters return HTTP 400 with type `error` and the same keys.

This is a deterministic Vietnamese FAQ responder, not an LLM integration or product recommendation
service. It supports accented/unaccented topic keywords and multiple recognized topics. Unrecognized
questions return an explicit unconfirmed-information fallback. Each template includes limitations;
matching a topic does not verify every premise or detail in a customer's question.

Knowledge lives in `server/services/ai/knowledge/faq.json`. Each topic records source paths and
the file records a review date. Facts were checked against footer/contact, payment/guide pages,
checkout and customer API; the root README contains no additional policies. When these sources
change, review the relevant answer, update its sources/review date, and rerun tests. This snapshot
is not automatically synchronized with source code or independently verified business information.

Payment account details conflict between policy and demo checkout: no account numbers are given
in FAQ. No verified returns/refunds policy, delivery coverage or delivery SLA was found. Contact
details are explicitly attributed to the website, not represented as independently verified.
No current voucher codes are supplied. No DAO/model/provider is imported; no order lookup, action,
database mutation or user-supplied instruction is executed.

Checks: `node --test server/tests/faq.test.js server/tests/product-search.test.js`.
FAQ route tests use an isolated Express app, without loading index.js, dotenv or MongoDB.
