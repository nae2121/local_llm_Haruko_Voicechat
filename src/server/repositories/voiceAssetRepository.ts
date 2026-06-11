import { VoiceAssetKind } from "@prisma/client";
import { prisma } from "@/server/db/prisma";

export async function createVoiceAsset(data: {
  messageId?: string | null;
  kind: VoiceAssetKind;
  filePath: string;
  mimeType: string;
  durationMs?: number | null;
  sizeBytes: number;
  transcript?: string | null;
}) {
  return prisma.voiceAsset.create({
    data: {
      messageId: data.messageId ?? null,
      kind: data.kind,
      filePath: data.filePath,
      mimeType: data.mimeType,
      durationMs: data.durationMs ?? null,
      sizeBytes: data.sizeBytes,
      transcript: data.transcript ?? null,
    },
  });
}

export async function getVoiceAsset(id: string) {
  return prisma.voiceAsset.findUnique({ where: { id } });
}
