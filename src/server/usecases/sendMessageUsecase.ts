import { MessageRole, ModelRunStatus } from "@prisma/client";
import { chatWithOllama } from "@/server/services/ollamaService";
import { createConversationUsecase } from "@/server/usecases/createConversationUsecase";
import { getConversationWithMessages, touchConversation } from "@/server/repositories/conversationRepository";
import { createMessage } from "@/server/repositories/messageRepository";
import { getModelConfigById } from "@/server/repositories/modelConfigRepository";
import { createModelRun } from "@/server/repositories/modelRunRepository";

export async function sendMessageUsecase(params: {
  conversationId?: string | null;
  message: string;
  modelConfigId?: string | null;
}) {
  const trimmedMessage = params.message.trim();
  if (!trimmedMessage) {
    throw new Error("メッセージを入力してください。");
  }

  const conversation =
    params.conversationId
      ? await getConversationWithMessages(params.conversationId)
      : await createConversationUsecase({
          firstMessage: trimmedMessage,
          modelConfigId: params.modelConfigId,
        });

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
    { role: MessageRole.system, content: modelConfig.systemPrompt },
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
    const latencyMs = Date.now() - startedAt;
    const assistantMessage = await createMessage({
      conversationId: conversation.id,
      role: MessageRole.assistant,
      contentText: outputText,
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
      assistantMessage,
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
