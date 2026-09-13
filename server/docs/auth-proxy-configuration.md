# Auth limiter deployment configuration

By default Express does not trust forwarded IP headers. Direct/untrusted peers
cannot change the rate-limit key using X-Forwarded-For.

When deploying behind a reverse proxy, set `TRUSTED_PROXY_CIDRS` to a comma-separated
list of verified proxy IP addresses or CIDRs. Local example only:
`TRUSTED_PROXY_CIDRS=127.0.0.1/32,::1/128`.
Do not copy the local example as a Render production topology assumption.

The repository does not establish Render's trusted ingress ranges. Confirm the
actual ingress topology/ranges with the deployment operator before configuration.
Only list proxy peers controlled by the deployment. The edge must sanitize/set
forwarded headers. Express evaluates the chain from the socket peer toward the
client and stops at the first untrusted address. Trust-all, `/0`, named ranges and
hop counts are deliberately not accepted. Invalid configuration stops startup.
No environment file is modified by this feature.

Without configuration behind a proxy, clients may share the proxy-IP bucket.
After configuration, verify distinct real client IPs and spoofed-header rejection.
The limiter remains process-local with bounded entries, fixed-window expiry and
no distributed enforcement across instances. Restarts clear limiter state.

An early disconnect releases in-flight bookkeeping but reserves an unresolved
attempt. A later authentication result finalizes it once; a known 500 does not
count as a credential failure. An outcome that never arrives reserves the attempt
until window expiry. Hung in-flight bookkeeping is released after 60 seconds.

Explicit password reset always persists fresh bcrypt, clears the reset token and
increments tokenVersion atomically, including same-password reset. Profile/staff
no-change edits and lazy storage migration retain their previous session policy.
