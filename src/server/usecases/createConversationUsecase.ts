import { toConversationTitle } from "@/lib/utils";
import { createConversation } from "@/server/repositories/conversationRepository";
import { getModelConfigById } from "@/server/repositories/modelConfigRepository";

export async function createConversationUsecase(params: {
  firstMessage: string;
  modelConfigId?: string | null;
}) {
  const modelConfig = await getModelConfigById(params.modelConfigId);
  return createConversation({
    title: toConversationTitle(params.firstMessage),
    modelConfigId: modelConfig.id,
  });
}
