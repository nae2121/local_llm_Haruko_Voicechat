import { NextResponse } from "next/server";
import { listConversations } from "@/server/repositories/conversationRepository";

export async function GET() {
  try {
    const conversations = await listConversations();
    return NextResponse.json({ conversations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "会話一覧の取得に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
