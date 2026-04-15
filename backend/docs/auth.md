# Auth Architecture (IFTS)

## Environments
- FRONTEND_URL, FRONTEND_ORIGIN, MAIL_FROM
- Gmail SMTP: GMAIL_USER (or GMAIL_EMAIL), GMAIL_APP_PASSWORD (or GMAIL_PASSWORD)
- Generic SMTP: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
- Brevo fallback: BREVO_API_KEY
- JWT_SECRET, JWT_REFRESH_SECRET
- DB_RESET (dev only), PORT

## Token Policy
- Access JWT: 15m, bearer header, payload: sub, role, companyIds, jti
- Refresh: 7d opaque token, stored hashed in RefreshToken, HttpOnly Secure SameSite=Lax cookie at /api/auth/refresh, rotated every refresh; reuse ⇒ revoke family
- Email verify: single-use hashed token, 24h
- Password reset: single-use hashed token, 30m

## Security Controls
- Bcrypt cost 12; password policy: >=8, upper, lower, digit
- Rate limits: login 5/15m, forgot 3/15m, register 20/h, refresh 60/15m
- CSRF: double-submit cookie (csrfToken) + x-csrf-token header on non-GET
- CORS: credentials with FRONTEND_ORIGIN
- HTTPS only, HttpOnly cookies, no tokens in localStorage

## Company + Role Enforcement
- Every protected request must send company_id via header x-company-id (preferred) or body/query/params.
- auth middleware verifies JWT; companyGuard enforces membership; role guard checks role after companyGuard.

## Endpoints
- POST /api/auth/register {name,email,password} → creates user (unverified), sends verify email
- GET /api/auth/verify?token=... → marks isVerified
- POST /api/auth/login {email,password,companyId?} → lockouts after 5 fails/15m; returns access token + sets refresh cookie; includes companies list
- POST /api/auth/refresh (cookie) → rotates refresh, returns new access
- POST /api/auth/forgot {email} → always generic response; sends reset if exists
- POST /api/auth/reset {token,password} → single use, revokes refresh tokens

## Email (SMTP/Brevo)
- sendVerificationEmail: link FRONTEND_URL/verify?token=...
- sendResetEmail: link FRONTEND_URL/reset-password?token=...

## Frontend Requirements
- Include credentials on requests; send x-csrf-token from csrfToken cookie for non-GET.
- Include x-company-id on protected calls; use access token in Authorization: Bearer.
- Rely on HttpOnly refresh cookie; do not store tokens in localStorage.

## Flows (text)
- Register: validate → hash pwd → create user (unverified) → create verify token (hash, 24h) → email → verify endpoint sets isVerified.
- Login: rate-limit → lock check → bcrypt → require verified → reset counters → issue access (15m) + refresh cookie (7d rotated) → return role + companies.
- Forgot/Reset: request → generic reply → create reset token (hash, 30m) → email → reset endpoint validates token → hash new pwd → mark used → revoke refresh tokens.
