# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| main    | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email **yogesh.vadivel@outlook.com** with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
3. Expect acknowledgment within 48 hours

## Security Model

ExpenseVision uses three layers of access control:

- **Middleware** — route-level auth enforcement via Supabase session cookies
- **API routes** — independent `supabase.auth.getUser()` check on every endpoint
- **Database** — Supabase Row Level Security (RLS) on all tables

Additional measures:
- File upload validation (MIME type, extension, magic bytes, size limit)
- Input sanitization via Zod schemas with HTML stripping
- Rate limiting on all mutation endpoints (Upstash Redis)
- CSP, HSTS, X-Frame-Options, Referrer-Policy headers
- Open-redirect prevention on auth callback paths
- Service role key restricted to account deletion only

## Known Limitations

- CSP allows `'unsafe-inline'` for styles (required by the CSS-in-JS approach)
- `'unsafe-eval'` in CSP is present for Next.js compatibility; nonce-based CSP is a tracked improvement
- No explicit CSRF token mechanism beyond SameSite cookie attributes
- Rate limit identifier falls back to `"unknown"` when forwarded headers are absent
