import { VoiceAssetKind } from "@prisma/client";
import { NextResponse } from "next/server";
import { createVoiceAsset } from "@/server/repositories/voiceAssetRepository";
import { saveAudioFile } from "@/server/services/audioStorageService";
import { synthesizeWithLocalTts } from "@/server/services/localVoiceService";

export const runtime = "nodejs";

type SynthesizeRequestBody = {
  text?: string;
  messageId?: string | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SynthesizeRequestBody;
    const text = body.text?.trim() ?? "";
    if (!text) {
      return NextResponse.json({ error: "読み上げテキストが必要です。" }, { status: 400 });
    }

    const result = await synthesizeWithLocalTts({ text });
    const filePath = await saveAudioFile({
      bytes: result.bytes,
      mimeType: result.mimeType,
      prefix: "output",
    });
    const asset = await createVoiceAsset({
      messageId: body.messageId ?? null,
      kind: VoiceAssetKind.output_audio,
      filePath,
      mimeType: result.mimeType,
      durationMs: result.durationMs,
      sizeBytes: result.bytes.byteLength,
      transcript: text,
    });

    return NextResponse.json({
      audioUrl: `/api/voice/assets/${asset.id}`,
      voiceAsset: {
        id: asset.id,
        url: `/api/voice/assets/${asset.id}`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "音声生成に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
