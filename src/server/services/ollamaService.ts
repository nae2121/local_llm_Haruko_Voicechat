import type { ModelConfig } from "@prisma/client";
import { env } from "@/lib/env";

type OllamaMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OllamaChatResponse = {
  message?: {
    role: string;
    content: string;
  };
  error?: string;
};

export class OllamaUnavailableError extends Error {
  constructor(message = "Ollamaが起動していません。Ollamaを起動してからもう一度お試しください。") {
    super(message);
    this.name = "OllamaUnavailableError";
  }
}

export async function chatWithOllama(params: {
  messages: OllamaMessage[];
  modelConfig: ModelConfig;
  timeoutMs?: number;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs ?? 60_000);

  try {
    const response = await fetch(`${env.ollamaBaseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: params.modelConfig.llmModel,
        messages: params.messages,
        stream: false,
        options: {
          temperature: params.modelConfig.temperature,
          top_p: params.modelConfig.topP,
          top_k: params.modelConfig.topK,
          num_predict: params.modelConfig.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || `Ollama API error: ${response.status}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    if (data.error) {
      throw new Error(data.error);
    }

    const content = data.message?.content?.trim();
    if (!content) {
      throw new Error("Ollamaから空の応答が返りました。");
    }

    return content;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Ollamaの応答がタイムアウトしました。");
    }

    if (error instanceof TypeError) {
      throw new OllamaUnavailableError();
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
