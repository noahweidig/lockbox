# LokBoks

Open source time-lock vault for Screen Time passcodes and other secrets. Next.js + Neon Postgres, deployed on Vercel.

- Accounts, email verification, password reset, change password, account deletion
- Many secrets per account, locked 5 minutes to 365 days
- Locks can only be extended by the user. AES-256-GCM with a per-secret key. Reveal needs the account password.
- 24-hour reveal pause after any password change or reset
- Admin dashboard at `/admin`: stats, user search, edit users, suspend, send resets, change/replace/delete locks, activity log. Admins never see secret values.

## Setup

1. Create a Neon project, copy the pooled connection string.
2. `cp .env.example .env.local` and fill in `DATABASE_URL`, `ENCRYPTION_KEY` (`openssl rand -base64 32`), `RESEND_API_KEY`, `EMAIL_FROM`.
3. Set `ADMIN_EMAILS=you@example.com`. Register with that email and confirm it to get admin access (or set `role='admin'` in the `users` table).
4. `npm install && npm run db:migrate && npm run dev`

## Deploy to Vercel

Import the repo, add the same env vars. `vercel-build` runs migrations before building.

## Security notes

- Losing `ENCRYPTION_KEY` makes all secrets unrecoverable. Whoever controls the server and that key can decrypt data; this is a self-control tool, not protection from the host.
- No tests against a live database have been run yet; verify the flows on a Neon branch before launch.
