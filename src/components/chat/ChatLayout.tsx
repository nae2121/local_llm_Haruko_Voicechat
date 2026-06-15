"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatInput } from "@/components/chat/ChatInput";
import { HarukoVoicePanel } from "@/components/chat/HarukoVoicePanel";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { ModelConfigPanel } from "@/components/chat/ModelConfigPanel";
import type { ChatMessage } from "@/features/chat/types";
import { useChat } from "@/features/chat/hooks/useChat";
import { useContinuousVoiceChat } from "@/features/voice/hooks/useContinuousVoiceChat";
import { useLocalSpeechSynthesis } from "@/features/voice/hooks/useLocalSpeechSynthesis";

export function ChatLayout() {
  const chat = useChat();
  const localTts = useLocalSpeechSynthesis();
  const { sendAudio } = chat;
  const { speak, outputLevel } = localTts;
  const [autoSpeak, setAutoSpeak] = useState(true);
  const lastSpokenMessageIdRef = useRef<string | null>(null);
  const voiceResponsePendingRef = useRef(false);

  const processVoiceAudio = useCallback(
    async (file: File) => {
      voiceResponsePendingRef.current = true;
      const assistantMessage = await sendAudio(file);
      if (!assistantMessage) {
        voiceResponsePendingRef.current = false;
      }
      return assistantMessage;
    },
    [sendAudio],
  );

  const speakVoiceResponse = useCallback(
    async (message: ChatMessage) => {
      lastSpokenMessageIdRef.current = message.id;
      voiceResponsePendingRef.current = false;
      await speak(message);
    },
    [speak],
  );

  const continuousVoice = useContinuousVoiceChat({
    processAudio: processVoiceAudio,
    speak: speakVoiceResponse,
  });
  const { playMessage } = continuousVoice;

  useEffect(() => {
    const lastMessage = chat.messages.at(-1);
    if (
      autoSpeak &&
      !voiceResponsePendingRef.current &&
      lastMessage?.role === "assistant" &&
      lastSpokenMessageIdRef.current !== lastMessage.id
    ) {
      lastSpokenMessageIdRef.current = lastMessage.id;
      void playMessage(lastMessage);
    }
  }, [autoSpeak, chat.messages, playMessage]);

  const handleSend = async (message: string) => {
    await chat.sendMessage(message);
  };

  const handleSpeak = async (message: ChatMessage) => {
    lastSpokenMessageIdRef.current = message.id;
    await playMessage(message);
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
            <span>入力: Gemma 4 Audio</span>
            <span>読み上げ: COEIROINK:蔓歌せら</span>
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

        <HarukoVoicePanel
          state={continuousVoice.state}
          level={
            continuousVoice.state === "speaking"
              ? outputLevel
              : continuousVoice.inputLevel
          }
          error={continuousVoice.error}
          isSupported={continuousVoice.isSupported}
          onStart={() => void continuousVoice.start()}
          onStop={() => void continuousVoice.stop()}
          onReconnect={() => void continuousVoice.reconnect()}
        />

        <div className="min-h-0 flex-1 overflow-hidden">
          {chat.isLoadingConversation ? (
            <div className="flex h-full items-center justify-center text-sm text-white/50">
              会話を読み込んでいます...
            </div>
          ) : (
            <ChatMessages
              messages={chat.messages}
              isSending={chat.isSending}
              onSpeak={handleSpeak}
              synthesizingMessageId={localTts.synthesizingMessageId}
              audioUrls={localTts.audioUrls}
            />
          )}
        </div>

        <ChatInput
          isSending={chat.isSending}
          onSend={handleSend}
        />
        <footer className="border-t border-white/10 bg-black/70 px-4 py-2 text-center text-[11px] text-white/45">
          Voice:{" "}
          <a
            href="https://coeiroink.com/"
            target="_blank"
            rel="noreferrer"
            className="hover:text-emerald-200"
          >
            COEIROINK:蔓歌せら（げんき！）
          </a>
        </footer>
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
