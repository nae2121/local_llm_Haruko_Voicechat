"use client";

import { useEffect, useRef, useState } from "react";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { ModelConfigPanel } from "@/components/chat/ModelConfigPanel";
import { useChat } from "@/features/chat/hooks/useChat";
import { useSpeechSynthesis } from "@/features/voice/hooks/useSpeechSynthesis";

export function ChatLayout() {
  const chat = useChat();
  const tts = useSpeechSynthesis();
  const [autoSpeak, setAutoSpeak] = useState(false);
  const lastSpokenMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    const lastMessage = chat.messages.at(-1);
    if (
      autoSpeak &&
      lastMessage?.role === "assistant" &&
      lastSpokenMessageIdRef.current !== lastMessage.id
    ) {
      lastSpokenMessageIdRef.current = lastMessage.id;
      tts.speak(lastMessage.contentText);
    }
  }, [autoSpeak, chat.messages, tts]);

  const handleSend = async (message: string) => {
    await chat.sendMessage(message);
  };

  return (
    <main className="flex min-h-dvh flex-col bg-[#050706] text-white md:flex-row">
      <ConversationSidebar
        conversations={chat.conversations}
        activeConversationId={chat.conversationId}
        onSelect={chat.loadConversation}
        onNew={chat.startNewConversation}
      />

      <section className="flex min-h-[70dvh] flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/70 px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold text-white">Haruko Voice Chat</h1>
            <p className="text-xs text-white/45">
              {chat.selectedModelConfig?.llmModel ?? "gemma4:12b"} via Ollama
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-white/65">
            <input
              type="checkbox"
              checked={autoSpeak}
              onChange={(event) => setAutoSpeak(event.target.checked)}
              className="h-4 w-4 accent-emerald-300"
            />
            自動読み上げ
          </label>
        </header>

        {chat.error ? (
          <div className="border-b border-red-300/20 bg-red-950/30 px-4 py-3 text-sm text-red-100">
            {chat.error}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-hidden">
          {chat.isLoadingConversation ? (
            <div className="flex h-full items-center justify-center text-sm text-white/50">
              会話を読み込んでいます...
            </div>
          ) : (
            <ChatMessages
              messages={chat.messages}
              isSending={chat.isSending}
              onSpeak={tts.speak}
              isSpeechSupported={tts.isSupported}
            />
          )}
        </div>

        <ChatInput isSending={chat.isSending} onSend={handleSend} />
      </section>

      <ModelConfigPanel
        configs={chat.modelConfigs}
        selectedConfig={chat.selectedModelConfig}
        selectedConfigId={chat.selectedModelConfigId}
        onSelect={chat.setSelectedModelConfigId}
        onSave={chat.saveModelConfig}
      />
    </main>
  );
}
