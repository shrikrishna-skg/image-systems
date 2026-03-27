-- Run this SQL in Supabase SQL Editor to set up tables
-- Go to: https://supabase.com/dashboard → SQL Editor

-- Users table (linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    images_processed INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Images table
CREATE TABLE IF NOT EXISTS public.images (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(36) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    width INTEGER,
    height INTEGER,
    file_size_bytes BIGINT,
    mime_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Image versions table
CREATE TABLE IF NOT EXISTS public.image_versions (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    image_id VARCHAR(36) NOT NULL REFERENCES public.images(id) ON DELETE CASCADE,
    version_type VARCHAR(50) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    width INTEGER,
    height INTEGER,
    file_size_bytes BIGINT,
    provider VARCHAR(50),
    model VARCHAR(100),
    prompt_used TEXT,
    scale_factor FLOAT,
    processing_cost_usd NUMERIC(10, 6),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Jobs table
CREATE TABLE IF NOT EXISTS public.jobs (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(36) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    image_id VARCHAR(36) NOT NULL REFERENCES public.images(id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    progress_pct INTEGER DEFAULT 0,
    error_message TEXT,
    params_json JSONB,
    result_version_id VARCHAR(36) REFERENCES public.image_versions(id),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- API keys: ciphertext only. Browser / Supabase anon+authenticated must not read this table;
-- the FastAPI backend uses the pooled postgres role (bypasses RLS) and decrypts only server-side.
CREATE TABLE IF NOT EXISTS public.api_keys (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(36) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    encrypted_key TEXT NOT NULL,
    label VARCHAR(100),
    is_valid BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_user_provider UNIQUE (user_id, provider)
);

-- Processing history (optional but recommended — used after upload / jobs)
CREATE TABLE IF NOT EXISTS public.processing_history (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    image_id VARCHAR(36),
    job_id VARCHAR(36),
    action VARCHAR(50) NOT NULL,
    provider VARCHAR(50),
    model VARCHAR(100),
    prompt_used TEXT,
    input_width INTEGER,
    input_height INTEGER,
    output_width INTEGER,
    output_height INTEGER,
    scale_factor DOUBLE PRECISION,
    quality VARCHAR(20),
    cost_usd NUMERIC(10, 6) DEFAULT 0,
    duration_seconds DOUBLE PRECISION,
    status VARCHAR(20) DEFAULT 'completed',
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.usage_stats (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    date DATE NOT NULL,
    images_uploaded INTEGER DEFAULT 0,
    images_enhanced INTEGER DEFAULT 0,
    images_upscaled INTEGER DEFAULT 0,
    total_cost_usd NUMERIC(10, 6) DEFAULT 0,
    api_calls_openai INTEGER DEFAULT 0,
    api_calls_gemini INTEGER DEFAULT 0,
    api_calls_replicate INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_usage_stats_user_date UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_processing_history_user_id ON public.processing_history(user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_images_user_id ON public.images(user_id);
CREATE INDEX IF NOT EXISTS idx_image_versions_image_id ON public.image_versions(image_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_image_id ON public.jobs(image_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_stats ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated sees only rows for auth.uid() (matches JWT sub / public.users.id). FastAPI postgres URL bypasses RLS.
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

-- No RLS policy for api_keys on authenticated: table grants are revoked below so PostgREST cannot expose rows.

CREATE POLICY "Users can manage own processing history" ON public.processing_history
    FOR ALL
    USING ((auth.uid())::text = user_id)
    WITH CHECK ((auth.uid())::text = user_id);

CREATE POLICY "Users can manage own usage stats" ON public.usage_stats
    FOR ALL
    USING ((auth.uid())::text = user_id)
    WITH CHECK ((auth.uid())::text = user_id);

-- Grant access to authenticated role
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.images TO authenticated;
GRANT ALL ON public.image_versions TO authenticated;
GRANT ALL ON public.jobs TO authenticated;
GRANT ALL ON public.processing_history TO authenticated;
GRANT ALL ON public.usage_stats TO authenticated;

-- Grant access to service_role (for backend)
GRANT ALL ON public.users TO service_role;
GRANT ALL ON public.images TO service_role;
GRANT ALL ON public.image_versions TO service_role;
GRANT ALL ON public.jobs TO service_role;
GRANT ALL ON public.api_keys TO service_role;
GRANT ALL ON public.processing_history TO service_role;
GRANT ALL ON public.usage_stats TO service_role;

-- Prefer explicit grants only: strip default PUBLIC/anon access (authenticated keeps GRANT ALL above).
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

-- Encrypted provider keys: no PostgREST access for anon/authenticated.
REVOKE ALL ON TABLE public.api_keys FROM PUBLIC;
REVOKE ALL ON TABLE public.api_keys FROM anon;
REVOKE ALL ON TABLE public.api_keys FROM authenticated;
