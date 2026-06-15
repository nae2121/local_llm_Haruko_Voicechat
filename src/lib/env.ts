export const env = {
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
  ollamaTimeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS ?? 120_000),
  ollamaKeepAlive: process.env.OLLAMA_KEEP_ALIVE ?? "10m",
  llmModel: process.env.LLM_MODEL ?? "gemma4:12b",
  sttServiceUrl: process.env.STT_SERVICE_URL ?? "http://127.0.0.1:8081",
  ttsServiceUrl: process.env.TTS_SERVICE_URL ?? "http://127.0.0.1:50032",
  ttsSpeakerUuid: process.env.TTS_SPEAKER_UUID ?? "dbf336ac-4daf-11ef-9733-0242ac1c000b",
  ttsStyleId: Number(process.env.TTS_STYLE_ID ?? 2),
};
