/** Single source for Integrations UI + Enhance panel — keep model lists in sync. */

export const PROVIDER_DOC_URLS: Record<string, string> = {
  openai: "https://platform.openai.com/api-keys",
  gemini: "https://aistudio.google.com/apikey",
  replicate: "https://replicate.com/account/api-tokens",
};

export const PROVIDER_CONSOLE_URLS: Record<string, string> = {
  openai: "https://platform.openai.com/docs/guides/image-generation",
  gemini: "https://ai.google.dev/gemini-api/docs/image-generation",
  replicate: "https://replicate.com/docs",
};

export const OPENAI_IMAGE_MODELS = ["gpt-image-1", "gpt-image-1.5", "gpt-image-1-mini"] as const;

export const GEMINI_IMAGE_MODELS = [
  "gemini-2.0-flash-exp-image-generation",
  "gemini-2.5-flash-image",
] as const;

export const PROVIDERS_ENHANCE = [
  { value: "improve" as const, label: "Improve", models: ["browser"] as string[] },
  { value: "openai" as const, label: "OpenAI", models: [...OPENAI_IMAGE_MODELS] },
  { value: "gemini" as const, label: "Google Gemini", models: [...GEMINI_IMAGE_MODELS] },
];
