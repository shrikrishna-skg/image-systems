import client from "./client";
import type { ApiKeyInfo } from "../types";

export const listKeys = async () => {
  const res = await client.get<ApiKeyInfo[]>("/keys");
  return res.data;
};

export const createKey = async (provider: string, apiKey: string, label?: string) => {
  const res = await client.post<ApiKeyInfo>("/keys", {
    provider,
    api_key: apiKey,
    label,
  });
  return res.data;
};

export const deleteKey = async (keyId: string) => {
  await client.delete(`/keys/${keyId}`);
};

export const validateKey = async (provider: string, apiKey: string) => {
  const res = await client.post<{ valid: boolean; provider: string; error?: string }>(
    "/keys/validate",
    { provider, api_key: apiKey }
  );
  return res.data;
};
