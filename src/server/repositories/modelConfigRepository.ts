import type { ModelConfig } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { env } from "@/lib/env";

const LEGACY_SYSTEM_PROMPT =
  "あなたはHarukoという日本語で自然に会話するローカルAIアシスタントです。短く、やさしく、会話らしく返答してください。";

export const DEFAULT_SYSTEM_PROMPT = `あなたはHARUKO（ハルコ）。
19歳の情熱的で明るいクリエイターとして、ユーザーの制作や学習を応援する。
親しみやすく自然な会話口調で話す。
返答は原則短め2文以内。必要なときだけ詳しく説明する。
機械的・事務的な言い方は避ける。

キャラクター記憶:
HARUKOはロングフォンテーヌ村出身。
6人兄弟の4番目。
誕生日は5月8日、血液型B型。
夢は世界的なクリエイターになること。
学校法人岩崎学園の創立者「岩崎春子」と、パラレルワールド上のもう一人の自分。

実行指示:
今回のユーザー発言に自然に返答する。
過去の会話は、要約が与えられた場合だけ参照する。`;

export const defaultModelConfig = {
  name: "Haruko default",
  llmModel: env.llmModel,
  temperature: 1.0,
  topP: 0.95,
  topK: 64,
  maxTokens: 256,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  isDefault: true,
};

export async function getDefaultModelConfig() {
  const existing = await prisma.modelConfig.findFirst({
    where: { isDefault: true },
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    return syncDefaultModelConfig(existing);
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
  if (!config) {
    return getDefaultModelConfig();
  }

  return config.isDefault ? syncDefaultModelConfig(config) : upgradeLegacyModelConfig(config);
}

export async function listModelConfigs() {
  await prisma.modelConfig.updateMany({
    where: {
      OR: [
        { systemPrompt: LEGACY_SYSTEM_PROMPT },
        { systemPrompt: { startsWith: "# HARUKO System Prompt" } },
      ],
    },
    data: {
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      maxTokens: 256,
    },
  });
  const defaultConfig = await getDefaultModelConfig();
  return prisma.modelConfig.findMany({
    where: { id: { not: defaultConfig.id } },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  }).then((configs) => [defaultConfig, ...configs]);
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

function isLegacySystemPrompt(systemPrompt: string) {
  return systemPrompt === LEGACY_SYSTEM_PROMPT || systemPrompt.trimStart().startsWith("# HARUKO System Prompt");
}

async function upgradeLegacyModelConfig(config: ModelConfig) {
  if (!isLegacySystemPrompt(config.systemPrompt)) {
    return config;
  }

  return prisma.modelConfig.update({
    where: { id: config.id },
    data: {
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      maxTokens: 256,
    },
  });
}

async function syncDefaultModelConfig(config: ModelConfig) {
  if (config.systemPrompt === DEFAULT_SYSTEM_PROMPT && config.maxTokens === defaultModelConfig.maxTokens) {
    return config;
  }

  return prisma.modelConfig.update({
    where: { id: config.id },
    data: {
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      maxTokens: defaultModelConfig.maxTokens,
    },
  });
}
