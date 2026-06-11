export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  id: string;
  conversationId: string;
  role: ChatRole;
  contentText: string;
  createdAt: string;
};

export type ConversationSummary = {
  id: string;
  title: string;
  modelConfigId: string;
  createdAt: string;
  updatedAt: string;
  messages?: ChatMessage[];
};

export type ModelConfig = {
  id: string;
  name: string;
  llmModel: string;
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  systemPrompt: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};
