import { NextResponse } from "next/server";
import { sendAudioMessageUsecase } from "@/server/usecases/sendAudioMessageUsecase";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "WAV音声ファイルが必要です。" }, { status: 400 });
    }
    if (!["audio/wav", "audio/x-wav"].includes(file.type)) {
      return NextResponse.json({ error: "音声はWAV形式で送信してください。" }, { status: 415 });
    }
    if (file.size === 0 || file.size > 1_000_000) {
      return NextResponse.json({ error: "音声サイズが不正です。" }, { status: 400 });
    }

    const conversationId = formData.get("conversationId");
    const modelConfigId = formData.get("modelConfigId");
    const result = await sendAudioMessageUsecase({
      conversationId: typeof conversationId === "string" && conversationId ? conversationId : null,
      modelConfigId: typeof modelConfigId === "string" && modelConfigId ? modelConfigId : null,
      file,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "音声チャットに失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
