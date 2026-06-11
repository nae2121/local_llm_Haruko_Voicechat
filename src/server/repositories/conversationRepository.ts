import { prisma } from "@/server/db/prisma";

export async function createConversation(data: { title: string; modelConfigId: string }) {
  return prisma.conversation.create({ data });
}

export async function listConversations() {
  return prisma.conversation.findMany({
    include: {
      modelConfig: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getConversationWithMessages(id: string) {
  return prisma.conversation.findUnique({
    where: { id },
    include: {
      modelConfig: true,
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function touchConversation(id: string) {
  return prisma.conversation.update({
    where: { id },
    data: { updatedAt: new Date() },
  });
}
