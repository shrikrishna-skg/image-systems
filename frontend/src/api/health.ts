import client from "./client";

export interface ApiHealth {
  status?: string;
  version?: string;
  auth?: string;
  persist_image_files_on_server?: boolean;
  ephemeral_image_grace_seconds?: number;
  local_dev_skip_upscale?: boolean;
  local_dev_upscale_fallback_on_credit_error?: boolean;
}

export async function getHealth(): Promise<ApiHealth> {
  const { data } = await client.get<ApiHealth>("/health");
  return data;
}
