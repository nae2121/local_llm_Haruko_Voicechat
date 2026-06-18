import { MessageRole, ModelRunStatus } from "@prisma/client";
import { chatWithOllama } from "@/server/services/ollamaService";
import { createConversationUsecase } from "@/server/usecases/createConversationUsecase";
import { getConversationWithMessages, touchConversation } from "@/server/repositories/conversationRepository";
import { createMessage } from "@/server/repositories/messageRepository";
import { getModelConfigById } from "@/server/repositories/modelConfigRepository";
import { createModelRun } from "@/server/repositories/modelRunRepository";
//ここを高校生が実装
const HARUKO_JSON_PROMPT = `
必ず次のJSONだけを返してください。

{
  "reply": "ユーザーへの返答",
  "emotion": "joy | anger | sadness | fun | neutral"
}

ルール:
- JSON以外を出力しない
- replyは短めで自然な日本語にする
- emotionは必ず5種類のどれかにする
- angerは強い怒りではなく、軽いツッコミや注意の感情として使う
- 判断に迷ったらneutralにする`;

type HarukoEmotion = "joy" | "anger" | "sadness" | "fun" | "neutral";

type HarukoJsonResponse = {
  reply: string;
  emotion: HarukoEmotion;
};

const allowedEmotions: HarukoEmotion[] = ["joy", "anger", "sadness", "fun", "neutral"];

function cleanJsonText(outputText: string) {
  let text = outputText.trim();
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);

  if (codeBlockMatch?.[1]) {
    return codeBlockMatch[1].trim();
  }

  if (text.startsWith("```json")) {
    text = text.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  }

  if (text.startsWith("```")) {
    text = text.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }

  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    return text.slice(jsonStart, jsonEnd + 1).trim();
  }

  return text.trim();
}

function parseHarukoResponse(outputText: string): HarukoJsonResponse {
  try {
    const data = JSON.parse(cleanJsonText(outputText)) as { reply?: unknown; emotion?: unknown };
    const reply = typeof data.reply === "string" ? data.reply.trim() : "";
    const emotion = typeof data.emotion === "string" ? data.emotion.trim().toLowerCase() : "";

    if (reply && allowedEmotions.includes(emotion as HarukoEmotion)) {
      return {
        reply,
        emotion: emotion as HarukoEmotion,
      };
    }
  } catch {
    // JSON parseに失敗したら、元テキストをneutralとして扱います。
  }

  return {
    reply: outputText,
    emotion: "neutral",
  };
}

export async function sendMessageUsecase(params: {
  conversationId?: string | null;
  message: string;
  modelConfigId?: string | null;
}) {
  const trimmedMessage = params.message.trim();
  if (!trimmedMessage) {
    throw new Error("メッセージを入力してください。");
  }

  const existingConversation = params.conversationId
    ? await getConversationWithMessages(params.conversationId)
    : null;
  const conversation =
    existingConversation ??
    (await createConversationUsecase({
      firstMessage: trimmedMessage,
      modelConfigId: params.modelConfigId,
    }));

  if (!conversation) {
    throw new Error("会話が見つかりません。");
  }

  const modelConfig = await getModelConfigById(params.modelConfigId ?? conversation.modelConfigId);
  const userMessage = await createMessage({
    conversationId: conversation.id,
    role: MessageRole.user,
    contentText: trimmedMessage,
  });

  const ollamaMessages = [
    {
      role: MessageRole.system,
      content: [modelConfig.systemPrompt, HARUKO_JSON_PROMPT].filter(Boolean).join("\n\n"),
    },
    ...(existingConversation?.messages ?? [])
      .filter((message) => message.role !== MessageRole.system)
      .map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.contentText,
      })),
    {
      role: userMessage.role as "system" | "user" | "assistant",
      content: userMessage.contentText,
    },
  ].filter((message) => message.role !== MessageRole.system || message.content.trim().length > 0);

  const startedAt = Date.now();

  try {
    const outputText = await chatWithOllama({
      messages: ollamaMessages,
      modelConfig,
    });
    const harukoResponse = parseHarukoResponse(outputText);
    const latencyMs = Date.now() - startedAt;
    const assistantMessage = await createMessage({
      conversationId: conversation.id,
      role: MessageRole.assistant,
      contentText: harukoResponse.reply,
    });

    await createModelRun({
      conversationId: conversation.id,
      messageId: assistantMessage.id,
      runType: "chat",
      provider: "ollama",
      modelName: modelConfig.llmModel,
      inputText: trimmedMessage,
      outputText,
      latencyMs,
      status: ModelRunStatus.success,
    });
    await touchConversation(conversation.id);

    return {
      conversationId: conversation.id,
      userMessage,
      assistantMessage: {
        ...assistantMessage,
        emotion: harukoResponse.emotion,
      },
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    await createModelRun({
      conversationId: conversation.id,
      messageId: userMessage.id,
      runType: "chat",
      provider: "ollama",
      modelName: modelConfig.llmModel,
      inputText: trimmedMessage,
      latencyMs,
      status: ModelRunStatus.error,
      errorMessage: error instanceof Error ? error.message : "不明なエラーが発生しました。",
    });
    throw error;
  }
}
