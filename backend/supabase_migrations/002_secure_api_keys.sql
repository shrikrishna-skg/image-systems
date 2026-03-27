-- Run once in Supabase SQL Editor for databases created from an older supabase_setup.sql
-- that granted authenticated access to public.api_keys.
-- Prefer 003_secure_rls_authenticated.sql for a full pass (includes this file’s api_keys changes plus scoped RLS).
--
-- After this: browser Supabase client (anon / authenticated JWT) cannot SELECT/INSERT/UPDATE/DELETE
-- api_keys. The FastAPI backend continues to work when using the pooled postgres DATABASE_URL.

DROP POLICY IF EXISTS "Users can manage own api keys" ON public.api_keys;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.api_keys FROM PUBLIC;
REVOKE ALL ON TABLE public.api_keys FROM anon;
REVOKE ALL ON TABLE public.api_keys FROM authenticated;

GRANT ALL ON TABLE public.api_keys TO service_role;
