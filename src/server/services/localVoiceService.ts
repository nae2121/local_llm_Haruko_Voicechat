import { env } from "@/lib/env";

type TranscribeResponse = {
  transcript?: string;
  text?: string;
  durationMs?: number;
};

type SynthesizeJsonResponse = {
  audioBase64?: string;
  mimeType?: string;
  durationMs?: number;
};

export async function transcribeWithLocalStt(params: {
  file: File;
  timeoutMs?: number;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs ?? 120_000);
  const formData = new FormData();
  formData.append("file", params.file, params.file.name || "audio.webm");

  try {
    const response = await fetch(`${env.sttServiceUrl}/transcribe`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || `STT service error: ${response.status}`);
    }

    const data = (await response.json()) as TranscribeResponse;
    const transcript = (data.transcript ?? data.text ?? "").trim();
    if (!transcript) {
      throw new Error("STT service returned an empty transcript.");
    }

    return {
      transcript,
      durationMs: data.durationMs ?? null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("STT service timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function synthesizeWithLocalTts(params: {
  text: string;
  timeoutMs?: number;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs ?? 120_000);

  try {
    const response = await fetch(`${env.ttsServiceUrl}/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: params.text }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || `TTS service error: ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "audio/wav";
    if (contentType.includes("application/json")) {
      const data = (await response.json()) as SynthesizeJsonResponse;
      if (!data.audioBase64) {
        throw new Error("TTS service did not return audioBase64.");
      }
      return {
        bytes: Buffer.from(data.audioBase64, "base64"),
        mimeType: data.mimeType ?? "audio/wav",
        durationMs: data.durationMs ?? null,
      };
    }

    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      mimeType: contentType.split(";")[0] ?? "audio/wav",
      durationMs: null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("TTS service timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
