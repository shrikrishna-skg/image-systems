/** Single source for Integrations UI + Enhance panel — keep model lists in sync. */

export const PROVIDER_DOC_URLS: Record<string, string> = {
  openai: "https://platform.openai.com/api-keys",
  gemini: "https://aistudio.google.com/apikey",
  replicate: "https://replicate.com/account/api-tokens",
  zyte: "https://app.zyte.com/o/zyte-api/api-access",
};

export const PROVIDER_CONSOLE_URLS: Record<string, string> = {
  openai: "https://platform.openai.com/docs/guides/image-generation",
  gemini: "https://ai.google.dev/gemini-api/docs/image-generation",
  replicate: "https://replicate.com/docs",
  zyte: "https://docs.zyte.com/zyte-api/usage/index.html",
};

/** Best / default-first, then mid, then budget (images.edit–capable; not chat models like gpt-4o). */
export const OPENAI_IMAGE_MODELS = ["gpt-image-1.5", "gpt-image-1", "gpt-image-1-mini"] as const;

/** Newer / stronger image output first; experimental Flash second (typically lower cost). */
export const GEMINI_IMAGE_MODELS = [
  "gemini-2.5-flash-image",
  "gemini-2.0-flash-exp-image-generation",
] as const;

/** UI labels for the enhancement Model dropdown (API ids unchanged). */
export const ENHANCE_IMAGE_MODEL_LABELS: Record<string, string> = {
  "gpt-image-1.5": "GPT Image 1.5 (best quality)",
  "gpt-image-1": "GPT Image 1",
  "gpt-image-1-mini": "GPT Image 1 Mini (budget / lower cost)",
  "gemini-2.5-flash-image": "Gemini 2.5 Flash Image (best)",
  "gemini-2.0-flash-exp-image-generation": "Gemini 2.0 Flash image (lower cost, experimental)",
};

export const PROVIDERS_ENHANCE = [
  { value: "improve" as const, label: "Improve", models: ["browser"] as string[] },
  { value: "openai" as const, label: "OpenAI", models: [...OPENAI_IMAGE_MODELS] },
  { value: "gemini" as const, label: "Google Gemini", models: [...GEMINI_IMAGE_MODELS] },
];
