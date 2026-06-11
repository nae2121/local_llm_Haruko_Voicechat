export const env = {
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
  llmModel: process.env.LLM_MODEL ?? "gemma4:12b",
};
