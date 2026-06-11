import { NextResponse } from "next/server";
import { getConversationWithMessages } from "@/server/repositories/conversationRepository";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const conversation = await getConversationWithMessages(id);
    if (!conversation) {
      return NextResponse.json({ error: "会話が見つかりません。" }, { status: 404 });
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "会話の取得に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
