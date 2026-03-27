# Security on GitHub

## What must not be in the repo

- **Never commit** real `frontend/.env`, `backend/.env`, or any file containing API keys, database URLs with passwords, or JWT secrets.
- **Never commit** `sb_secret_*` (Supabase secret key). It belongs only in **server** environment variables (e.g. `backend/.env` locally, or your host’s secret store).
- **Publishable** keys (`sb_publishable_*` / `VITE_SUPABASE_ANON_KEY`) are intended for the browser, but you should still **avoid committing** them so each environment (dev/staging/prod) can use its own project or keys.

Templates without real values live in `frontend/.env.example` and `backend/.env.example`.

## GitHub repository

1. Confirm **Settings → Code security** options you want (e.g. secret scanning if available on your plan).
2. For **GitHub Actions**, store values under **Settings → Secrets and variables → Actions** (e.g. `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `DATABASE_URL`). Reference them in workflows as `${{ secrets.NAME }}` — do not echo them in logs.
3. If a secret was ever pushed, **rotate it** in the Supabase dashboard (and anywhere else it was used), then remove it from git history if needed (`git filter-repo` / GitHub support) — rotating is the critical step.

## Docker

`docker-compose.yml` loads `frontend/.env` and `backend/.env` from your machine; those files stay **local** and ignored by git.

## Database

- Put the **Postgres connection string** only in `backend/.env` as `DATABASE_URL` (never in the frontend or in Git).
- Prefer Supabase **Transaction pooler** (port **6543**) for the FastAPI app. The backend enables **TLS automatically** when the host looks like Supabase; override with `DATABASE_SSL_REQUIRE=true|false` if needed.
