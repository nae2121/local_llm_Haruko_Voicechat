export const env = {
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
  llmModel: process.env.LLM_MODEL ?? "gemma4:12b",
  sttServiceUrl: process.env.STT_SERVICE_URL ?? "http://127.0.0.1:8081",
  ttsServiceUrl: process.env.TTS_SERVICE_URL ?? "http://127.0.0.1:8082",
};
