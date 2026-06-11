import { NextResponse } from "next/server";
import { chatService } from "@/server/services/chatService";

type ChatRequestBody = {
  conversationId?: string | null;
  message?: string;
  modelConfigId?: string | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const result = await chatService.sendMessage({
      conversationId: body.conversationId ?? null,
      message: body.message ?? "",
      modelConfigId: body.modelConfigId ?? null,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "チャット送信に失敗しました。";
    const status = message.includes("入力してください") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
