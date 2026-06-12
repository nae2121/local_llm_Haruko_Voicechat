"use client";

import { useEffect, useRef, useState } from "react";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { ModelConfigPanel } from "@/components/chat/ModelConfigPanel";
import type { ChatMessage } from "@/features/chat/types";
import { useChat } from "@/features/chat/hooks/useChat";
import { useLocalSpeechSynthesis } from "@/features/voice/hooks/useLocalSpeechSynthesis";
import { useSpeechSynthesis } from "@/features/voice/hooks/useSpeechSynthesis";
import type { VoiceInputMode, VoiceOutputMode } from "@/features/voice/types";

export function ChatLayout() {
  const chat = useChat();
  const browserTts = useSpeechSynthesis();
  const localTts = useLocalSpeechSynthesis();
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [voiceInputMode, setVoiceInputMode] = useState<VoiceInputMode>("browser");
  const [voiceOutputMode, setVoiceOutputMode] = useState<VoiceOutputMode>("browser");
  const lastSpokenMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    const lastMessage = chat.messages.at(-1);
    if (
      autoSpeak &&
      lastMessage?.role === "assistant" &&
      lastSpokenMessageIdRef.current !== lastMessage.id
    ) {
      lastSpokenMessageIdRef.current = lastMessage.id;
      if (voiceOutputMode === "local_tts") {
        void localTts.speak(lastMessage);
      } else {
        browserTts.speak(lastMessage.contentText);
      }
    }
  }, [autoSpeak, browserTts, chat.messages, localTts, voiceOutputMode]);

  const handleSend = async (message: string) => {
    await chat.sendMessage(message);
  };

  const handleSpeak = async (message: ChatMessage) => {
    if (voiceOutputMode === "local_tts") {
      await localTts.speak(message);
      return;
    }

    browserTts.speak(message.contentText);
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
          <div className="flex flex-wrap items-center gap-3 text-xs text-white/65">
            <label className="flex items-center gap-2">
              入力
              <select
                value={voiceInputMode}
                onChange={(event) => setVoiceInputMode(event.target.value as VoiceInputMode)}
                className="border border-white/10 bg-black px-2 py-1 text-white outline-none"
              >
                <option value="browser">browser</option>
                <option value="local_whisper">local_whisper</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              読み上げ
              <select
                value={voiceOutputMode}
                onChange={(event) => setVoiceOutputMode(event.target.value as VoiceOutputMode)}
                className="border border-white/10 bg-black px-2 py-1 text-white outline-none"
              >
                <option value="browser">browser</option>
                <option value="local_tts">local_tts</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoSpeak}
                onChange={(event) => setAutoSpeak(event.target.checked)}
                className="h-4 w-4 accent-emerald-300"
              />
              自動読み上げ
            </label>
          </div>
        </header>

        {chat.error ? (
          <div className="border-b border-red-300/20 bg-red-950/30 px-4 py-3 text-sm text-red-100">
            {chat.error}
          </div>
        ) : null}
        {localTts.error ? (
          <div className="border-b border-red-300/20 bg-red-950/30 px-4 py-3 text-sm text-red-100">
            {localTts.error}
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
              voiceOutputMode={voiceOutputMode}
              onSpeak={handleSpeak}
              isSpeechSupported={browserTts.isSupported}
              synthesizingMessageId={localTts.synthesizingMessageId}
              audioUrls={localTts.audioUrls}
            />
          )}
        </div>

        <ChatInput
          isSending={chat.isSending}
          voiceInputMode={voiceInputMode}
          onSend={handleSend}
        />
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
