export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  id: string;
  conversationId: string;
  role: ChatRole;
  contentText: string;
  createdAt: string;
  voiceAssets?: VoiceAsset[];
};

export type VoiceAsset = {
  id: string;
  messageId: string | null;
  kind: "input_audio" | "output_audio";
  filePath?: string;
  mimeType: string;
  durationMs: number | null;
  sizeBytes: number;
  transcript: string | null;
  createdAt: string;
  url?: string;
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
