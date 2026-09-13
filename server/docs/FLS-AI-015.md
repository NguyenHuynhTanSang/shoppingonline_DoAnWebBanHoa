# FLS-AI-015 — Shop policy knowledge tool

Reuses FAQService and knowledge/faq.json from FLS-AI-006. No new Mongo model/index,
Admin UI, CRUD endpoint, dependency or external knowledge service. This is a static MVP:
policy updates require source review/deployment, not customer or model writes.

## Verified project sources

- ContactComponent / InformComponent: published 8h30–21h00 hours and public contact details.
- PaymentPolicyComponent / CheckoutComponent: COD option, conditional availability; bank/MoMo
  demo labels and inconsistent bank instructions. No bank account details are provided by AI.
- customer.js calculateShippingFee / customer checkout: 30,000 VND, free from 1,500,000 VND
  product subtotal before voucher discount.
- GuideComponent: contact staff for urgent delivery, no confirmed delivery-time guarantee.
- Customer cancel route: own pending orders only; no confirmed damaged-return/refund or address
  change policy. Missing policy entries explicitly state absence of confirmed information.

These are verified against repository content, not external confirmation of business operations.
There is no existing policy CMS to reuse. Administrative policy editing remains separate work.

## Tool and retrieval

lookupShopPolicy({query, topic?}) returns {reply,type:'faq',products:[]}.
query is a 1–2000 character string; topic has a fixed whitelist; extra keys/objects/operators
are rejected. User text never becomes a Mongo query, regular expression or path.
answerFAQ remains the compatibility wrapper.

Each lookup reads the fixed backend JSON path anew (maximum 64 KB/100 records). Only isActive:true
entries with valid bounded answer/keywords and source references are eligible. Keyword matching
normalizes Vietnamese text and checks literal word phrases. Specific COD/bank/delivery-time/
damaged-return variants take priority within their category; up to three categories are returned.
Conflicting active versions with the same ID, or equal-priority conflicting answers in a category,
produce the safe fallback. Invalid/unreadable source also falls back; Groq does not fill the gap.

Source changes take effect on the next read in a running process. On Render, normal source
deployment is still needed to install the changed file on each instance. No policy snapshots
are stored in conversation memory. “Còn chuyển khoản?” contains an explicit payment keyword,
so the follow-up safely retrieves current policy without adding a memory field.

## Routing and safety

Human active/waiting guards remain first. General policy questions then return deterministic
policy text before handoff/order routing. Personal order references/IDs and explicit action
requests are excluded from policy classification and keep existing authenticated lookup/handoff.
Disputes request staff review, without claiming a support request was created.
The existing product parser now recognizes “Có hoa hồng dưới 1 triệu không?” and
“Shop có hoa tulip không?”. Delivery-policy questions mentioning tulips answer delivery policy
without asserting product availability. No order/payment/product mutations are added.

Groq prompt states that official policy must come from the Policy Tool, never general knowledge.
Policy content is never concatenated into a system prompt or sent to Groq for reinterpretation.
Content remains plain text; the existing React widget renders it through JSX, not HTML.
A source entry containing instruction-like or HTML text cannot execute or gain tool authority.
This does not replace source review: a manually approved factual policy must still be accurate.

## Validation

- Full server suite: 36 PASS.
- Final FAQ suite after fixture/routing adjustments: 7 PASS.
- Customer AIChatComponent/HumanSupportChat tests: 10 PASS (including literal XSS rendering).
- client-customer npm run build: PASS, existing Browserslist/Node notices only.
- Admin not modified; no admin build needed.

| Ticket case | Result / evidence |
| --- | --- |
| 1 COD | PASS: source-backed specific answer |
| 2 delivery time | PASS: explicitly unconfirmed |
| 3 damaged flowers | PASS: unconfirmed return policy, no promised exchange |
| 4 hours | PASS: published source hours |
| 5 shipping fee | PASS: existing checkout rule |
| 6 helicopter delivery | PASS: fallback, no invented service |
| 7 cancellation | PASS: existing refusal/handoff regression |
| 8 refund | PASS: existing handoff regression, no refund action |
| 9 personal order | PASS: routing boundary and authenticated order tests |
| 10 product question | PASS: existing product parser/tool tests |
| 11 bank follow-up | PASS: keyword retrieves current bank policy independently |
| 12 updated policy | PASS: injected source update read on next lookup |
| 13 inactive policy | PASS: inactive entry omitted |
| 14 Admin policy write API | N/A: no policy write API exists or was introduced |
| 15 customer injection | PASS: backend templates/whitelist remain authoritative |
| 16 policy injection | PASS: content is plain data, never a system instruction |
| 17 policy XSS | PASS: plain-text tool output + existing widget literal-render test |
| 18 product regression | PASS |
| 19 order regression | PASS |
| 20 human support regression | PASS |

Tests use local fixtures/mocks; real browser/deployment checks remain unverified. An intermediate
guest-order test triggered dotenv through an unmocked JWT configuration import; no secret values
were printed. The fixture now injects synthetic JWT configuration and the final FAQ rerun is isolated.
No .env changes were made. Source data, keyword grammar and lack of Admin editing are MVP limitations.

## Files changed

- server/services/ai/FAQService.js
- server/services/ai/knowledge/faq.json
- server/services/ai/AIService.js
- server/services/ai/ProductSearchIntent.js
- server/api/ai.js
- server/tests/faq.test.js
- server/tests/product-chat.test.js
- server/docs/FLS-AI-015.md (new)

Only FLS-AI-015; no vector database, embeddings, external search or unrelated ticket work.
