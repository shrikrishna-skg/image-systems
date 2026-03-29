const PROVIDER_DOC_URLS = {
  openai: "https://platform.openai.com/api-keys",
  gemini: "https://aistudio.google.com/apikey",
  replicate: "https://replicate.com/account/api-tokens",
  zyte: "https://app.zyte.com/o/zyte-api/api-access",
  groq: "https://console.groq.com/keys"
};
const PROVIDER_CONSOLE_URLS = {
  openai: "https://platform.openai.com/docs/guides/image-generation",
  gemini: "https://ai.google.dev/gemini-api/docs/image-generation",
  replicate: "https://replicate.com/docs",
  zyte: "https://docs.zyte.com/zyte-api/usage/index.html",
  groq: "https://console.groq.com/docs/overview"
};
const OPENAI_IMAGE_MODELS = ["gpt-image-1.5", "gpt-image-1", "gpt-image-1-mini"];
const GEMINI_IMAGE_MODELS = [
  "gemini-2.5-flash-image",
  "gemini-2.0-flash-exp-image-generation"
];
const ENHANCE_IMAGE_MODEL_LABELS = {
  "gpt-image-1.5": "GPT Image 1.5 (best quality)",
  "gpt-image-1": "GPT Image 1",
  "gpt-image-1-mini": "GPT Image 1 Mini (budget / lower cost)",
  "gemini-2.5-flash-image": "Gemini 2.5 Flash Image (best)",
  "gemini-2.0-flash-exp-image-generation": "Gemini 2.0 Flash image (lower cost, experimental)"
};
const PROVIDERS_ENHANCE = [
  { value: "improve", label: "Improve", models: ["browser"] },
  { value: "openai", label: "OpenAI", models: [...OPENAI_IMAGE_MODELS] },
  { value: "gemini", label: "Google Gemini", models: [...GEMINI_IMAGE_MODELS] }
];
export {
  ENHANCE_IMAGE_MODEL_LABELS,
  GEMINI_IMAGE_MODELS,
  OPENAI_IMAGE_MODELS,
  PROVIDERS_ENHANCE,
  PROVIDER_CONSOLE_URLS,
  PROVIDER_DOC_URLS
};
