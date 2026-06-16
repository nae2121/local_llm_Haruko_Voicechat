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
    thinking?: string;
  };
  done?: boolean;
  done_reason?: string;
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
  const timeoutMs = params.timeoutMs ?? env.ollamaTimeoutMs;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const resetTimeout = () => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => controller.abort(), timeoutMs);
  };
  resetTimeout();

  try {
    const response = await fetch(`${env.ollamaBaseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: params.modelConfig.llmModel,
        messages: params.messages,
        stream: true,
        think: false,
        keep_alive: env.ollamaKeepAlive,
        options: {
          temperature: params.modelConfig.temperature,
          top_p: params.modelConfig.topP,
          top_k: params.modelConfig.topK,
          num_predict: 128,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || `Ollama API error: ${response.status}`);
    }

    if (!response.body) {
      throw new Error("Ollamaから応答本文が返りませんでした。");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    let hadThinking = false;
    let doneReason: string | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        break;
      }

      resetTimeout();
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const chunk = parseStreamLine(line);
        content += chunk.content;
        hadThinking ||= chunk.hadThinking;
        doneReason = chunk.doneReason ?? doneReason;
      }
    }

    const finalChunk = parseStreamLine(buffer);
    content += finalChunk.content;
    hadThinking ||= finalChunk.hadThinking;
    doneReason = finalChunk.doneReason ?? doneReason;
    content = content.trim();
    if (!content) {
      if (hadThinking || doneReason === "length") {
        throw new Error(
          "Ollamaが内部思考だけで生成上限に達しました。",
        );
      }
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
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function parseStreamLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) {
    return { content: "", hadThinking: false, doneReason: undefined };
  }

  const data = JSON.parse(trimmed) as OllamaChatResponse;
  if (data.error) {
    throw new Error(data.error);
  }

  return {
    content: data.message?.content ?? "",
    hadThinking: Boolean(data.message?.thinking),
    doneReason: data.done_reason,
  };
}
