import { prisma } from "@/server/db/prisma";
import { env } from "@/lib/env";

export const DEFAULT_SYSTEM_PROMPT =
  "あなたはHarukoという日本語で自然に会話するローカルAIアシスタントです。短く、やさしく、会話らしく返答してください。";

export const defaultModelConfig = {
  name: "Haruko default",
  llmModel: env.llmModel,
  temperature: 1.0,
  topP: 0.95,
  topK: 64,
  maxTokens: 2048,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  isDefault: true,
};

export async function getDefaultModelConfig() {
  const existing = await prisma.modelConfig.findFirst({
    where: { isDefault: true },
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    return existing;
  }

  return prisma.modelConfig.create({
    data: defaultModelConfig,
  });
}

export async function getModelConfigById(id: string | null | undefined) {
  if (!id) {
    return getDefaultModelConfig();
  }

  const config = await prisma.modelConfig.findUnique({ where: { id } });
  return config ?? getDefaultModelConfig();
}

export async function listModelConfigs() {
  await getDefaultModelConfig();
  return prisma.modelConfig.findMany({
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
}

export type ModelConfigInput = {
  id?: string;
  name: string;
  llmModel: string;
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  systemPrompt: string;
  isDefault: boolean;
};

export async function upsertModelConfig(data: ModelConfigInput) {
  if (data.isDefault) {
    await prisma.modelConfig.updateMany({
      where: data.id ? { isDefault: true, id: { not: data.id } } : { isDefault: true },
      data: { isDefault: false },
    });
  }

  if (data.id) {
    const { id, ...updateData } = data;
    return prisma.modelConfig.update({
      where: { id },
      data: updateData,
    });
  }

  const { id: _id, ...createData } = data;
  return prisma.modelConfig.create({ data: createData });
}
