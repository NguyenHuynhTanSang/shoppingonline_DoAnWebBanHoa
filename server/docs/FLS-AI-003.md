# FLS-AI-003: Product Search Tool

## Chat integration update

AIService now invokes this tool for basic product-search phrases, e.g. `Tìm hoa dưới 1 triệu`,
`Tìm hoa từ 1 triệu đến 2 triệu`, `Tìm hoa tulip`. ProductSearchIntent uses a bounded Vietnamese
grammar; no LLM-generated query or dynamic execution is used. Ambiguous monetary inputs request
clarification. This is basic keyword/budget search, not full natural-language understanding or ranking.
Replies list only names and stored prices from tool results, with no generative second pass.

New `inStockOnly` boolean defaults to true; false includes all stock. Do not combine it with the
legacy availability option. Positive safe-integer limits above 5 are now clamped to 5 (not rejected).
Chat always forces available stock, requests 4 results, and checks stock/budget again before rendering.
Response: `{reply, type: "product_recommendation", products: [{id,name,price,image,category,stock}]}`;
category in chat is a name string or null. The internal tool's existing category object is preserved.
No matches gives an explicit message and []; query failure gives 503, never invented products.
General chat and previously implemented FAQ/order paths remain unchanged.

The sections below describe the internal tool; the integration and limit updates above take precedence.

Internal backend tool: `require('../services/ai/tools/ProductSearchTool').searchProducts(input)`
(example require path from a file in `server/api`). Integrated through the existing `/api/ai/chat` endpoint.
The tool calls ProductDAO; only the DAO builds MongoDB filters and accesses the existing Product model.

## Input

An optional plain object with only the following fields. Unknown fields, objects/operators in scalar
fields, numeric strings, nulls and invalid values are rejected with `INVALID_PRODUCT_SEARCH_INPUT`.

| Field | Contract |
| --- | --- |
| keyword | Optional nonblank string, at most 200 characters; literal case-insensitive substring across name, description, category.name and submenu.name |
| category | Optional 24-character hexadecimal category ObjectId string; exact embedded category._id match |
| minPrice / maxPrice | Optional finite nonnegative numbers, inclusive bounds on database price; minPrice must not exceed maxPrice |
| availability | `in_stock` (default, stock > 0), `out_of_stock` (stock <= 0), or `all` |
| inStockOnly | Optional boolean; defaults to true; cannot combine with availability |
| limit | Positive safe integer, default 5, clamped to maximum 5 in the database |

`occasion` is unsupported because the current schema has no dedicated occasion data. Supplying it
returns a validation error. A caller can explicitly search occasion wording with `keyword`, but this
is text matching, not a verified occasion classification. Raw `stock` filters are unsupported; use availability.
Recommendations requiring available products must retain `in_stock`.

## Output

An array of `{ id, name, price, image, category: { id, name } | null, stock }`.
`image` is null when missing. Price is the stored `price`, not a calculated discounted checkout price.
Stock and price come exclusively from the query result. Records missing valid name/price/stock are omitted,
so fewer than the requested limit may be returned. No matches returns `[]`. Results sort by `_id`.
Stock reflects query time and does not reserve inventory.

Example input:

```json
{"keyword":"hoa hồng","minPrice":100000,"maxPrice":500000,"availability":"in_stock","limit":3}
```

Illustrative output only, not a claim about actual Atlas data:

```json
[{"id":"0123456789abcdef01234567","name":"Hoa hồng","price":250000,"image":"/hoa.png","category":{"id":"1123456789abcdef01234567","name":"Bó hoa"},"stock":2}]
```

Database errors, including timeouts, throw `PRODUCT_SEARCH_UNAVAILABLE` with a generic message;
no raw database error is logged or forwarded by the tool. MongoDB execution has a 3000 ms limit;
connection/server-selection timing remains controlled by existing Mongoose configuration.

## Checks

Run `node --test server/tests/product-search.test.js` from repository root. Tests mock the model query
chain and verify validation, constructed filters, literal regex escaping, projection, bounds and errors.
They do not read environment files or connect to MongoDB. Actual MongoDB execution is not covered.
