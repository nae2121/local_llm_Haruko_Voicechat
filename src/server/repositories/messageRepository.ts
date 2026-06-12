import { MessageRole } from "@prisma/client";
import { prisma } from "@/server/db/prisma";

export async function createMessage(data: {
  conversationId: string;
  role: MessageRole;
  contentText: string;
}) {
  return prisma.message.create({
    data,
    include: { voiceAssets: true },
  });
}

export async function listMessagesForConversation(conversationId: string) {
  return prisma.message.findMany({
    where: { conversationId },
    include: { voiceAssets: true },
    orderBy: { createdAt: "asc" },
  });
}
