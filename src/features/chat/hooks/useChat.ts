"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChatMessage, ConversationSummary, ModelConfig } from "@/features/chat/types";

type ChatResponse = {
  conversationId: string;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
};

type ConversationResponse = {
  conversation: ConversationSummary & { messages: ChatMessage[] };
};

const createLocalMessage = (role: "user" | "assistant", contentText: string): ChatMessage => ({
  id: `local-${role}-${Date.now()}`,
  conversationId: "local",
  role,
  contentText,
  createdAt: new Date().toISOString(),
});

export function useChat() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>([]);
  const [selectedModelConfigId, setSelectedModelConfigId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedModelConfig = useMemo(
    () => modelConfigs.find((config) => config.id === selectedModelConfigId) ?? modelConfigs[0],
    [modelConfigs, selectedModelConfigId],
  );

  const fetchConversations = useCallback(async () => {
    const response = await fetch("/api/conversations");
    const data = (await response.json()) as { conversations?: ConversationSummary[]; error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? "会話一覧を取得できませんでした。");
    }
    setConversations(data.conversations ?? []);
  }, []);

  const fetchModelConfigs = useCallback(async () => {
    const response = await fetch("/api/model-configs");
    const data = (await response.json()) as { modelConfigs?: ModelConfig[]; error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? "モデル設定を取得できませんでした。");
    }
    const configs = data.modelConfigs ?? [];
    setModelConfigs(configs);
    setSelectedModelConfigId((current) => current ?? configs.find((config) => config.isDefault)?.id ?? configs[0]?.id ?? null);
  }, []);

  useEffect(() => {
    Promise.all([fetchConversations(), fetchModelConfigs()]).catch((fetchError: unknown) => {
      setError(fetchError instanceof Error ? fetchError.message : "初期データの取得に失敗しました。");
    });
  }, [fetchConversations, fetchModelConfigs]);

  const loadConversation = useCallback(async (id: string) => {
    setIsLoadingConversation(true);
    setError(null);
    try {
      const response = await fetch(`/api/conversations/${id}`);
      const data = (await response.json()) as ConversationResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "会話を取得できませんでした。");
      }
      setConversationId(data.conversation.id);
      setMessages(data.conversation.messages);
      setSelectedModelConfigId(data.conversation.modelConfigId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "会話を取得できませんでした。");
    } finally {
      setIsLoadingConversation(false);
    }
  }, []);

  const startNewConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setError(null);
  }, []);

  const sendMessage = useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (!trimmed || isSending) {
        return null;
      }

      setIsSending(true);
      setError(null);
      setMessages((current) => [...current, createLocalMessage("user", trimmed)]);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId,
            message: trimmed,
            modelConfigId: selectedModelConfigId,
          }),
        });
        const data = (await response.json()) as ChatResponse & { error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "送信に失敗しました。");
        }

        setConversationId(data.conversationId);
        setMessages((current) => [
          ...current.filter((item) => !item.id.startsWith("local-user-")),
          data.userMessage,
          data.assistantMessage,
        ]);
        await fetchConversations();
        return data.assistantMessage;
      } catch (sendError) {
        setMessages((current) => current.filter((item) => !item.id.startsWith("local-user-")));
        setError(sendError instanceof Error ? sendError.message : "送信に失敗しました。");
        return null;
      } finally {
        setIsSending(false);
      }
    },
    [conversationId, fetchConversations, isSending, selectedModelConfigId],
  );

  const saveModelConfig = useCallback(
    async (input: Omit<ModelConfig, "createdAt" | "updatedAt">) => {
      setError(null);
      const response = await fetch("/api/model-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await response.json()) as { modelConfig?: ModelConfig; error?: string };
      if (!response.ok || !data.modelConfig) {
        throw new Error(data.error ?? "モデル設定を保存できませんでした。");
      }
      await fetchModelConfigs();
      setSelectedModelConfigId(data.modelConfig.id);
      return data.modelConfig;
    },
    [fetchModelConfigs],
  );

  return {
    conversationId,
    conversations,
    messages,
    modelConfigs,
    selectedModelConfig,
    selectedModelConfigId,
    isSending,
    isLoadingConversation,
    error,
    setSelectedModelConfigId,
    loadConversation,
    startNewConversation,
    sendMessage,
    saveModelConfig,
  };
}
