import { NextResponse } from "next/server";
import { getVoiceAsset } from "@/server/repositories/voiceAssetRepository";
import { readAudioFile } from "@/server/services/audioStorageService";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const asset = await getVoiceAsset(id);
    if (!asset) {
      return NextResponse.json({ error: "音声ファイルが見つかりません。" }, { status: 404 });
    }

    const bytes = await readAudioFile(asset.filePath);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": String(asset.sizeBytes),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "音声ファイルの取得に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
