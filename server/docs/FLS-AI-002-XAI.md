# xAI integration

Historical ticket only: superseded by FLS-AI-002-GROQ.md. The active provider is Groq;
XAI_API_KEY/XAI_MODEL are no longer used and the xAI adapter has been replaced.

Configure backend environment XAI_API_KEY (secret) and XAI_MODEL (default grok-4.6).
Do not put keys in frontend variables or commit environment files. Restart the backend after
configuration/code changes. Node 18+ with native fetch is required; no package was added.

POST /api/ai/chat accepts a required string message, 1–2000 characters, trimmed before sending.
General chat returns `{reply, type: "general", products: []}`. Existing verified FAQ and authenticated
order-status paths remain unchanged; this ticket adds no order/product tools to Grok.
General messages are sent to https://api.x.ai/v1/chat/completions using a server-only Bearer key.
System instructions prohibit fabricated store facts and data mutations. These are LLM instructions,
not a guarantee that every generated statement is accurate. No tools/database access is granted.

Errors retain reply/type/products and add code: INVALID_MESSAGE (400), XAI_NOT_CONFIGURED (503),
XAI_TIMEOUT (504, 20 seconds), XAI_PROVIDER_ERROR (502, including key/model access failures),
XAI_INVALID_RESPONSE (502), XAI_NETWORK_ERROR (503). Raw provider bodies/errors are neither logged
nor returned. No automatic retries or fallback answers hide provider failures. Chat is stateless.

Reference: https://docs.x.ai/developers/model-capabilities/legacy/chat-completions
Tests: node --test server/tests/*.test.js
Live smoke check requires configured backend environment and xAI model access; mock tests do not
prove account credentials, quota or model availability. The existing widget uses a generic error
message for non-authentication errors; inspect HTTP response code for the specific provider failure.
