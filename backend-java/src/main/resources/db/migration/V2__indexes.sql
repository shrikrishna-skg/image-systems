-- List/query performance (Postgres profile)
CREATE INDEX IF NOT EXISTS idx_images_user_created ON images (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_user_created ON jobs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_versions_image ON image_versions (image_id);
