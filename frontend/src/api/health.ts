import client from "./client";

export type HealthResponse = {
  status: string;
  version: string;
  auth: string;
  local_dev_skip_upscale?: boolean;
  local_dev_upscale_fallback_on_credit_error?: boolean;
};

export async function getHealth(): Promise<HealthResponse> {
  const res = await client.get<HealthResponse>("/health");
  return res.data;
}
