import { MessageRole, ModelRunStatus, VoiceAssetKind } from "@prisma/client";
import { createConversationUsecase } from "@/server/usecases/createConversationUsecase";
import { getConversationWithMessages, touchConversation } from "@/server/repositories/conversationRepository";
import { createMessage } from "@/server/repositories/messageRepository";
import { getModelConfigById } from "@/server/repositories/modelConfigRepository";
import { createModelRun } from "@/server/repositories/modelRunRepository";
import { createVoiceAsset } from "@/server/repositories/voiceAssetRepository";
import { saveAudioFile } from "@/server/services/audioStorageService";
import { chatWithGemmaAudio } from "@/server/services/gemmaAudioService";

export async function sendAudioMessageUsecase(params: {
  conversationId?: string | null;
  modelConfigId?: string | null;
  file: File;
}) {
  const existingConversation = params.conversationId
    ? await getConversationWithMessages(params.conversationId)
    : null;
  if (params.conversationId && !existingConversation) {
    throw new Error("会話が見つかりません。");
  }

  const modelConfig = await getModelConfigById(
    params.modelConfigId ?? existingConversation?.modelConfigId,
  );
  const history = (existingConversation?.messages ?? [])
    .filter((message) => message.role !== MessageRole.system)
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.contentText,
    }));
  const bytes = Buffer.from(await params.file.arrayBuffer());
  const startedAt = Date.now();

  try {
    const result = await chatWithGemmaAudio({
      file: params.file,
      modelConfig,
      history,
    });
    const conversation =
      existingConversation ??
      (await createConversationUsecase({
        firstMessage: result.transcript,
        modelConfigId: modelConfig.id,
      }));
    const userMessage = await createMessage({
      conversationId: conversation.id,
      role: MessageRole.user,
      contentText: result.transcript,
    });
    const filePath = await saveAudioFile({
      bytes,
      mimeType: params.file.type || "audio/wav",
      prefix: "input",
    });
    const inputAsset = await createVoiceAsset({
      messageId: userMessage.id,
      kind: VoiceAssetKind.input_audio,
      filePath,
      mimeType: params.file.type || "audio/wav",
      durationMs: result.durationMs,
      sizeBytes: bytes.byteLength,
      transcript: result.transcript,
    });
    const assistantMessage = await createMessage({
      conversationId: conversation.id,
      role: MessageRole.assistant,
      contentText: result.response,
    });

    await createModelRun({
      conversationId: conversation.id,
      messageId: assistantMessage.id,
      runType: "audio_chat",
      provider: "huggingface_transformers",
      modelName: "google/gemma-4-12B-it",
      inputText: result.transcript,
      outputText: result.rawOutput,
      latencyMs: Date.now() - startedAt,
      status: ModelRunStatus.success,
    });
    await touchConversation(conversation.id);

    return {
      conversationId: conversation.id,
      transcript: result.transcript,
      response: result.response,
      userMessage: {
        ...userMessage,
        voiceAssets: [inputAsset],
      },
      assistantMessage,
    };
  } catch (error) {
    if (existingConversation) {
      await createModelRun({
        conversationId: existingConversation.id,
        runType: "audio_chat",
        provider: "huggingface_transformers",
        modelName: "google/gemma-4-12B-it",
        inputText: "[audio]",
        latencyMs: Date.now() - startedAt,
        status: ModelRunStatus.error,
        errorMessage: error instanceof Error ? error.message : "不明なエラーが発生しました。",
      });
    }
    throw error;
  }
}
