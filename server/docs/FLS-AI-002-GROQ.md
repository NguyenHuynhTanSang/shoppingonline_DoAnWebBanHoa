# Groq backend integration

Official provider: Groq, using https://api.groq.com/openai/v1/chat/completions.
This is Groq's compatibility endpoint, not OpenAI's service. No xAI fallback exists.

Set backend environment GROQ_API_KEY and GROQ_MODEL, then restart `npm start` from server.
Both are required. Choose a model available to your Groq account; no model is hard-coded.
Never put the key in frontend configuration, commits, logs or responses. Node 18+ required;
native fetch is used and no dependencies were added.

POST /api/ai/chat accepts `{ "message": "Tôi cần tư vấn hoa sinh nhật" }`.
Message must be a nonblank string at most 2000 characters and is trimmed before provider use.
Groq success: `{ "reply": "...", "type": "general", "products": [] }`.
Existing FAQ/order-status handlers are preserved but not expanded; no product tools, database,
conversation history, orders or admin actions are supplied to Groq.

Errors contain reply, type=error, products=[], code. Codes: INVALID_MESSAGE (400),
GROQ_NOT_CONFIGURED/GROQ_MODEL_MISSING (503), GROQ_TIMEOUT (504, 20 seconds),
GROQ_RATE_LIMIT (429), GROQ_PROVIDER_ERROR/GROQ_INVALID_RESPONSE (502),
GROQ_NETWORK_ERROR (503), AI_ERROR (500). Raw provider errors/headers are not exposed.
No automatic retry hides errors or increases usage. System instructions constrain store claims
but do not guarantee accuracy of generated text.

## 404 diagnosis

Frontend baseURL ends in /api and posts /ai/chat. server/index.js mounts /api/ai and api/ai.js
registers POST /chat. Do not add duplicate routes. The local process previously returned 404 while
source route tests passed; its start time preceded the route updates. Restart the existing backend
to load current source. If 404 persists, verify the terminal's working directory and the process
listening on 3000. Changes on disk do not reload `node index.js` automatically.

Tests: node --test server/tests/*.test.js. Provider tests use mocked HTTP and synthetic credentials;
they do not read .env or prove live account/model access.
Reference: https://console.groq.com/docs/api-reference
