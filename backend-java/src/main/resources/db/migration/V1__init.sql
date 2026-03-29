-- PostgreSQL baseline (spring.profiles.active=postgres, ddl-auto=validate).
-- Column names follow Spring Boot default physical naming (camelCase -> snake_case).

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    images_processed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS images (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    original_filename VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    width INTEGER,
    height INTEGER,
    file_size_bytes BIGINT,
    mime_type VARCHAR(50),
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS image_versions (
    id VARCHAR(36) PRIMARY KEY,
    image_id VARCHAR(36) NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    version_type VARCHAR(50) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    width INTEGER,
    height INTEGER,
    file_size_bytes BIGINT,
    provider VARCHAR(50),
    model VARCHAR(100),
    prompt_used TEXT,
    scale_factor DOUBLE PRECISION,
    processing_cost_usd NUMERIC(10,6),
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    image_id VARCHAR(36) NOT NULL REFERENCES images(id),
    job_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    progress_pct INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    params_json JSONB,
    result_version_id VARCHAR(36) REFERENCES image_versions(id),
    started_at TIMESTAMP(6) WITH TIME ZONE,
    completed_at TIMESTAMP(6) WITH TIME ZONE,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    provider VARCHAR(50) NOT NULL,
    encrypted_key TEXT NOT NULL,
    label VARCHAR(100),
    valid BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_user_provider UNIQUE (user_id, provider)
);

CREATE TABLE IF NOT EXISTS processing_history (
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
    cost_usd NUMERIC(10,6) DEFAULT 0,
    duration_seconds DOUBLE PRECISION,
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_processing_history_user ON processing_history(user_id);

CREATE TABLE IF NOT EXISTS usage_stats (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    date DATE NOT NULL,
    images_uploaded INTEGER DEFAULT 0,
    images_enhanced INTEGER DEFAULT 0,
    images_upscaled INTEGER DEFAULT 0,
    total_cost_usd NUMERIC(10,6) DEFAULT 0,
    api_calls_openai INTEGER DEFAULT 0,
    api_calls_gemini INTEGER DEFAULT 0,
    api_calls_replicate INTEGER DEFAULT 0,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_stats_user ON usage_stats(user_id);
