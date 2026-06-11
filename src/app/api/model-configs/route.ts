import { NextResponse } from "next/server";
import { listModelConfigs, upsertModelConfig } from "@/server/repositories/modelConfigRepository";

type ModelConfigBody = {
  id?: string;
  name?: string;
  llmModel?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  systemPrompt?: string;
  isDefault?: boolean;
};

export async function GET() {
  try {
    const modelConfigs = await listModelConfigs();
    return NextResponse.json({ modelConfigs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "モデル設定の取得に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ModelConfigBody;
    const required = [
      body.name,
      body.llmModel,
      body.temperature,
      body.topP,
      body.topK,
      body.maxTokens,
      body.systemPrompt,
    ];

    if (required.some((value) => value === undefined || value === null || value === "")) {
      return NextResponse.json({ error: "モデル設定の入力が不足しています。" }, { status: 400 });
    }

    const modelConfig = await upsertModelConfig({
      id: body.id || undefined,
      name: body.name!,
      llmModel: body.llmModel!,
      temperature: Number(body.temperature),
      topP: Number(body.topP),
      topK: Number(body.topK),
      maxTokens: Number(body.maxTokens),
      systemPrompt: body.systemPrompt!,
      isDefault: Boolean(body.isDefault),
    });

    return NextResponse.json({ modelConfig });
  } catch (error) {
    const message = error instanceof Error ? error.message : "モデル設定の保存に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
