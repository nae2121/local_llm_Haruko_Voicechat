import { ModelRunStatus } from "@prisma/client";
import { prisma } from "@/server/db/prisma";

export async function createModelRun(data: {
  conversationId: string;
  messageId?: string;
  runType: string;
  provider: string;
  modelName: string;
  inputText: string;
  outputText?: string;
  latencyMs: number;
  status: ModelRunStatus;
  errorMessage?: string;
}) {
  return prisma.modelRun.create({
    data: {
      ...data,
      messageId: data.messageId ?? null,
      outputText: data.outputText ?? null,
      errorMessage: data.errorMessage ?? null,
    },
  });
}
