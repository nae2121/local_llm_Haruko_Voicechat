import { env } from "@/lib/env";

type TranscribeResponse = {
  text?: string;
};

type SynthesizeJsonResponse = {
  audioBase64?: string;
  mimeType?: string;
  durationMs?: number;
};

type CoeiroinkSpeaker = {
  speakerName: string;
  speakerUuid: string;
  styles: Array<{
    styleName: string;
    styleId: number;
  }>;
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
    const response = await fetch(`${env.sttBaseUrl}/transcribe`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || `STT service error: ${response.status}`);
    }

    const data = (await response.json()) as TranscribeResponse;
    const transcript = (data.text ?? "").trim();
    if (!transcript) {
      throw new Error("STT service returned an empty transcript.");
    }

    return { transcript };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("STT service timed out.");
    }
    if (error instanceof TypeError) {
      throw new Error(`STT serviceに接続できません。FastAPIが ${env.sttBaseUrl} で待機していることを確認してください。`);
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
    const speakersResponse = await fetch(`${env.ttsServiceUrl}/v1/speakers`, {
      signal: controller.signal,
    });
    if (!speakersResponse.ok) {
      throw new Error(`COEIROINKの話者一覧を取得できませんでした: ${speakersResponse.status}`);
    }

    const speakers = (await speakersResponse.json()) as CoeiroinkSpeaker[];
    const speaker = speakers.find((item) => item.speakerUuid === env.ttsSpeakerUuid);
    if (!speaker) {
      throw new Error("COEIROINKに「蔓歌せら」が導入されていません。音声モデルを追加して再起動してください。");
    }
    if (!speaker.styles.some((style) => style.styleId === env.ttsStyleId)) {
      throw new Error("COEIROINKに「蔓歌せら（げんき！）」スタイルが見つかりません。");
    }

    const response = await fetch(`${env.ttsServiceUrl}/v1/synthesis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: params.text,
        speakerUuid: env.ttsSpeakerUuid,
        styleId: env.ttsStyleId,
        speedScale: 1,
        volumeScale: 1,
        pitchScale: 0,
        intonationScale: 1,
        prosodyDetail: [],
        prePhonemeLength: 0.1,
        postPhonemeLength: 0.1,
        outputSamplingRate: 44_100,
        sampledIntervalValue: 0,
        adjustedF0: [],
        processingAlgorithm: "coeiroink",
      }),
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
      throw new Error("COEIROINKの音声生成がタイムアウトしました。");
    }
    if (error instanceof TypeError) {
      throw new Error(
        `COEIROINKに接続できません。COEIROINKを起動し、APIが ${env.ttsServiceUrl} で待機していることを確認してください。`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
