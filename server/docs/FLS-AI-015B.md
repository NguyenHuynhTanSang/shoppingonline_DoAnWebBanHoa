# FLS-AI-015B — Policy routing and responses

POST `/api/ai/chat` retains `{ reply, type: 'faq', products: [], conversationId? }`. Internal policy keys, metadata and source paths are not exposed to the customer.

Routing: validate input -> check authenticated human active/waiting -> general policy -> explicit handoff/dispute -> contextual policy follow-up -> authenticated order lookup -> product search/general chat. Policy tool is no longer called before the human-active check. Recheck human status before sending an answer after asynchronous context operations.

Policy selection stays deterministic. FAQService validates and normalizes queries and uses the canonical lookup. Extra keywords handle cutoff and English policy-injection variants. Unknown policy/payment/transport questions receive the verified-information fallback; failures receive a safe retry/contact message. There is no provider fallback for a recognized policy request.

The formatter uses canonical content as plain text, removes a few internal/redundant closing sentences and changes Customer to Bạn. It does not generate facts or send tool data to Groq. Existing system instruction already requires official policy from Policy Tool, forbids general ecommerce assumptions and disallows cancellation/refund/order changes. It remains in place.

Context adds optional nullable `AIConversation.lastPolicyTopic` (category whitelist); old conversations remain readable without migration. Save only the topic, never policy text or numeric rules. Follow-up payment requests use explicit keywords; shipping budget/merchant-fault follow-ups use the previous shipping category, then requery canonical data. Budget follow-ups explain the threshold without claiming the customer's amount is a verified pre-voucher subtotal. Non-policy turns clear the topic. Existing ownership, expiry, revision checks and human-support invalidation still apply.

Specific order cancellation eligibility first reads the authenticated customer's order and appends current cancellation policy only for one resolved order. No order, payment or refund writes. Explicit cancellation requests reuse the existing handoff (including suffix “giúp tôi”), with existing ownership/id validation and deduplication.

Validation: policy-routing HTTP suite covers policy variants, no metadata exposure, no Groq for policy, injection as data, missing policy, tool errors, updated tool results in one conversation, product/order boundaries and human-active suppression. Full server tests and customer build are required; frontend has no changes.

Limits: deterministic phrasing coverage is finite; ambiguous inputs may require clarification. A mixed request about product availability and shipping receives policy without asserting availability. No new policy rules, admin CRUD, provider changes or action tools.
