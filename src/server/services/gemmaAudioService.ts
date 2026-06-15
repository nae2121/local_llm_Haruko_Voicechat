import type { ModelConfig } from "@prisma/client";
import { env } from "@/lib/env";

type GemmaAudioResponse = {
  transcript?: string;
  response?: string;
  rawOutput?: string;
  durationMs?: number;
};

export async function chatWithGemmaAudio(params: {
  file: File;
  modelConfig: ModelConfig;
  history: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.gemmaAudioTimeoutMs);
  const formData = new FormData();
  formData.append("file", params.file, params.file.name || "speech.wav");
  formData.append(
    "context_json",
    JSON.stringify({
      systemPrompt: params.modelConfig.systemPrompt,
      history: params.history,
      temperature: params.modelConfig.temperature,
      topP: params.modelConfig.topP,
      topK: params.modelConfig.topK,
      maxTokens: params.modelConfig.maxTokens,
    }),
  );

  try {
    const response = await fetch(`${env.gemmaAudioServiceUrl}/chat/audio`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(text || `Gemma audio service error: ${response.status}`);
    }

    const data = JSON.parse(text) as GemmaAudioResponse;
    const transcript = data.transcript?.trim() || "[音声入力]";
    const assistantResponse = data.response?.trim() || data.rawOutput?.trim();
    if (!assistantResponse) {
      throw new Error("Gemma音声サービスから回答が返りませんでした。");
    }

    return {
      transcript,
      response: assistantResponse,
      rawOutput: data.rawOutput ?? assistantResponse,
      durationMs: data.durationMs ?? null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Gemma音声サービスがタイムアウトしました。");
    }
    if (error instanceof TypeError) {
      throw new Error(
        `Gemma音声サービスに接続できません。FastAPIが ${env.gemmaAudioServiceUrl} で待機していることを確認してください。`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
