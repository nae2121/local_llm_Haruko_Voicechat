import { VoiceAssetKind } from "@prisma/client";
import { NextResponse } from "next/server";
import { saveAudioFile } from "@/server/services/audioStorageService";
import { transcribeWithLocalStt } from "@/server/services/localVoiceService";
import { createVoiceAsset } from "@/server/repositories/voiceAssetRepository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const messageId = formData.get("messageId");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "音声ファイルが必要です。" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";
    const filePath = await saveAudioFile({ bytes, mimeType, prefix: "input" });
    const result = await transcribeWithLocalStt({ file });
    const asset = await createVoiceAsset({
      messageId: typeof messageId === "string" && messageId ? messageId : null,
      kind: VoiceAssetKind.input_audio,
      filePath,
      mimeType,
      durationMs: result.durationMs,
      sizeBytes: bytes.byteLength,
      transcript: result.transcript,
    });

    return NextResponse.json({
      transcript: result.transcript,
      voiceAsset: {
        id: asset.id,
        url: `/api/voice/assets/${asset.id}`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "文字起こしに失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
