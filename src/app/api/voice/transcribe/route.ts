import { NextResponse } from "next/server";
import { transcribeWithLocalStt } from "@/server/services/localVoiceService";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "音声ファイルが必要です。" }, { status: 400 });
    }

    const result = await transcribeWithLocalStt({ file });
    return NextResponse.json({ text: result.transcript });
  } catch (error) {
    const message = error instanceof Error ? error.message : "文字起こしに失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
