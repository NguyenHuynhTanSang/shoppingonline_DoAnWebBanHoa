# FLS-AI-015A — Canonical policy lookup

Canonical backend content: `services/ai/knowledge/faq.json`. Each topic has a stable `id`, category, title, keywords, priority, active flag and reviewed source paths. Do not infer business decisions from model output. Original sources are Guide, ShippingPolicy, ReturnPolicy, PaymentPolicy, Contact and checkout code.

`FAQService.lookupShopPolicy({ query, topic? })` is synchronous and read-only. Query is a non-empty string up to 2000 characters. Topic is a category whitelist (legacy `delivery` aliases `shipping`). Extra fields, objects/operators and invalid types are rejected; operator text is never executed. No database, provider or write API is involved.

Result: `{ found, category, policies: [{ key, category, title, content, sources }] }`. No match, unreadable/invalid source, or conflicting records returns `{ found: false, category: null, policies: [] }`. Input validation errors throw. Literal accent-normalized keywords use word boundaries; per-category priority selects a focused answer, maximum three categories. Unsupported Bitcoin/helicopter questions never infer an official policy.

Categories: shopping, shipping, payment, returns, refund, cancellation, order_changes, contact, hours, voucher. Shipping keys cover fee/free_shipping/area/same_day/cutoff/time_slots/processing/recipient_absent/redelivery; other keys cover shopping.guide, payment.cod/methods, order.cancel/change, returns.wrong_product/missing_product/damaged_product/change_of_mind, refund.general, contact, hours, voucher.

Numeric ownership:
- Shipping fee and free threshold: `utils/ShippingRules.js`, shared by checkout API and policy templates.
- Delivery slots: existing `utils/DeliveryValidation.js`.
- Same-day cutoff: `faq.json.rules.sameDayCutoff`, confirmed policy only; checkout enforcement is not added.
- Current redelivery amount follows the existing shipping fee in templates; if business separates the amounts, introduce a separately reviewed rule.

Freshness: JSON is reread per lookup, not stored in conversation memory. Changes to JS constants require a normal backend restart. `answerFAQ()` preserves `{ reply, type: 'faq', products: [] }`, so existing AI routing uses updated data with no Groq/system-prompt changes. Policy text remains data. Handoff and order tools retain their action/auth boundaries; invoking lookup with a cancellation request only reads policy.

Frontend content remains static, not a CMS. Change canonical backend rules first, then update corresponding page copy and frontend calculations in the same change. `policy-canonical.test.js` detects drift in current fee boundaries, displayed fee/threshold, cutoff and slot arrays. Prose still requires review against source pages. Do not treat these tests as automatic synchronization of all copy.

Unconfirmed: exact delivery guarantees, refund percentage/timeline, compensation, mandatory reporting deadline and replacement eligibility. COD is implemented; bank/MoMo are demo. No admin CRUD, vector DB, embeddings, schema change or new public API.

Checks: `node --test tests/*.test.js`; `git diff --check`.
