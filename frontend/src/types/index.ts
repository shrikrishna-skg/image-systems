/** Signed-in account. Email is the stable username; `id` is the server primary key for scoping data. */
export interface User {
  id: string;
  email: string;
  full_name: string | null;
  images_processed: number;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface ApiKeyInfo {
  id: string;
  provider: string;
  masked_key: string;
  label: string | null;
  is_valid: boolean;
  created_at: string;
}

export interface ImageInfo {
  id: string;
  original_filename: string;
  width: number | null;
  height: number | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  created_at: string;
  versions: ImageVersion[];
}

/** Sanitized server job params (snake_case) for replay in the UI. */
export type GenerationParams = Record<string, unknown>;

export interface ImageVersion {
  id: string;
  version_type: string;
  width: number | null;
  height: number | null;
  file_size_bytes: number | null;
  provider: string | null;
  model: string | null;
  scale_factor: number | null;
  processing_cost_usd: number | null;
  created_at: string;
  prompt_used?: string | null;
  source_job_type?: string | null;
  generation_params?: GenerationParams | null;
}

export interface JobInfo {
  id: string;
  image_id: string;
  job_type: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress_pct: number;
  error_message: string | null;
  result_version_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface EnhancementRequest {
  provider: string;
  model: string;
  lighting: string | null;
  quality_preset: string | null;
  perspective: string | null;
  room_type: string;
  custom_prompt: string | null;
  output_format: string;
  quality: string;
  auto_rotation_rad?: number | null;
}

export interface UpscaleRequest {
  scale_factor: number;
  target_resolution: string | null;
  output_format: string;
}

export interface FullPipelineRequest {
  provider: string;
  model: string;
  lighting: string | null;
  quality_preset: string | null;
  perspective: string | null;
  room_type: string;
  custom_prompt: string | null;
  quality: string;
  scale_factor: number;
  target_resolution: string | null;
  output_format: string;
  /** Radians, browser-estimated; server builds perspective plate + corner-outpaint prompt for OpenAI/Gemini. */
  auto_rotation_rad?: number | null;
}

export interface CostEstimate {
  enhancement_cost: number;
  upscale_cost: number;
  total_cost: number;
  provider: string;
  model: string;
  details: string;
}

export interface Presets {
  lighting: string[];
  quality: string[];
  perspective: string[];
  room_types: string[];
}
