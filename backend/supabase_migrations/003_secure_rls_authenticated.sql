-- Full security pass for existing Supabase projects: run once in SQL Editor.
-- Includes api_keys lockdown (same as 002) plus user-scoped RLS for all other app tables.
-- Safe to re-run: drops named policies by IF EXISTS, then recreates.
--
-- FastAPI with pooled postgres DATABASE_URL bypasses RLS; this protects direct PostgREST / supabase-js access.

-- --- api_keys: no client role access ---
DROP POLICY IF EXISTS "Users can manage own api keys" ON public.api_keys;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.api_keys FROM PUBLIC;
REVOKE ALL ON TABLE public.api_keys FROM anon;
REVOKE ALL ON TABLE public.api_keys FROM authenticated;
GRANT ALL ON TABLE public.api_keys TO service_role;

-- --- Replace permissive policies with auth.uid() scope ---
DROP POLICY IF EXISTS "Users can manage own data" ON public.users;
DROP POLICY IF EXISTS "Users can manage own images" ON public.images;
DROP POLICY IF EXISTS "Users can manage own image versions" ON public.image_versions;
DROP POLICY IF EXISTS "Users can manage own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can manage own processing history" ON public.processing_history;
DROP POLICY IF EXISTS "Users can manage own usage stats" ON public.usage_stats;

CREATE POLICY "Users can manage own data" ON public.users
    FOR ALL
    USING ((auth.uid())::text = id)
    WITH CHECK ((auth.uid())::text = id);

CREATE POLICY "Users can manage own images" ON public.images
    FOR ALL
    USING ((auth.uid())::text = user_id)
    WITH CHECK ((auth.uid())::text = user_id);

CREATE POLICY "Users can manage own image versions" ON public.image_versions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.images i
            WHERE i.id = image_versions.image_id AND i.user_id = (auth.uid())::text
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.images i
            WHERE i.id = image_versions.image_id AND i.user_id = (auth.uid())::text
        )
    );

CREATE POLICY "Users can manage own jobs" ON public.jobs
    FOR ALL
    USING (
        (auth.uid())::text = user_id
        AND EXISTS (
            SELECT 1 FROM public.images i
            WHERE i.id = jobs.image_id AND i.user_id = (auth.uid())::text
        )
    )
    WITH CHECK (
        (auth.uid())::text = user_id
        AND EXISTS (
            SELECT 1 FROM public.images i
            WHERE i.id = jobs.image_id AND i.user_id = (auth.uid())::text
        )
    );

CREATE POLICY "Users can manage own processing history" ON public.processing_history
    FOR ALL
    USING ((auth.uid())::text = user_id)
    WITH CHECK ((auth.uid())::text = user_id);

CREATE POLICY "Users can manage own usage stats" ON public.usage_stats
    FOR ALL
    USING ((auth.uid())::text = user_id)
    WITH CHECK ((auth.uid())::text = user_id);

-- --- Revoke broad access (authenticated keeps explicit GRANT ALL from original setup) ---
REVOKE ALL ON TABLE public.users FROM PUBLIC;
REVOKE ALL ON TABLE public.users FROM anon;
REVOKE ALL ON TABLE public.images FROM PUBLIC;
REVOKE ALL ON TABLE public.images FROM anon;
REVOKE ALL ON TABLE public.image_versions FROM PUBLIC;
REVOKE ALL ON TABLE public.image_versions FROM anon;
REVOKE ALL ON TABLE public.jobs FROM PUBLIC;
REVOKE ALL ON TABLE public.jobs FROM anon;
REVOKE ALL ON TABLE public.processing_history FROM PUBLIC;
REVOKE ALL ON TABLE public.processing_history FROM anon;
REVOKE ALL ON TABLE public.usage_stats FROM PUBLIC;
REVOKE ALL ON TABLE public.usage_stats FROM anon;
