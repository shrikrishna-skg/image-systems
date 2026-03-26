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

-- API Keys table
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

-- RLS Policies (allow all for authenticated users - backend handles auth)
CREATE POLICY "Users can manage own data" ON public.users
    FOR ALL USING (true);

CREATE POLICY "Users can manage own images" ON public.images
    FOR ALL USING (true);

CREATE POLICY "Users can manage own image versions" ON public.image_versions
    FOR ALL USING (true);

CREATE POLICY "Users can manage own jobs" ON public.jobs
    FOR ALL USING (true);

CREATE POLICY "Users can manage own api keys" ON public.api_keys
    FOR ALL USING (true);

-- Grant access to authenticated role
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.images TO authenticated;
GRANT ALL ON public.image_versions TO authenticated;
GRANT ALL ON public.jobs TO authenticated;
GRANT ALL ON public.api_keys TO authenticated;

-- Grant access to service_role (for backend)
GRANT ALL ON public.users TO service_role;
GRANT ALL ON public.images TO service_role;
GRANT ALL ON public.image_versions TO service_role;
GRANT ALL ON public.jobs TO service_role;
GRANT ALL ON public.api_keys TO service_role;
