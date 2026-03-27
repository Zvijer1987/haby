# Security Policy

## Supported deployment model

Haby is designed for private, self-hosted use.

Recommended baseline:

- private LAN or VPN-first deployment
- reverse proxy with HTTPS
- private bind mount for `/data`
- changed default password on first login
- current container image rebuilds when dependencies change

## Reporting a vulnerability

If you discover a security issue, avoid posting exploit details in a public issue first. Share a private report with the maintainer and include:

- affected version or commit
- reproduction steps
- expected impact
- any suggested mitigation

## Current security notes

The current codebase already includes some useful protections:

- HTTP-only session cookie
- same-site cookie policy
- login rate limiting
- authentication and admin route guards
- same-origin write blocking for mutating requests

## Additional hardening recommendations

- run behind HTTPS in production
- keep the container off the public internet unless you understand the risk
- rotate the default account password immediately
- back up `/data` regularly
- keep host file permissions limited to the service user
