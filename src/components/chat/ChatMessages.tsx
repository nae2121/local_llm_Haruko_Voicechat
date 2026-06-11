"use client";

import type { ChatMessage } from "@/features/chat/types";
import { cn } from "@/lib/utils";

type ChatMessagesProps = {
  messages: ChatMessage[];
  isSending: boolean;
  onSpeak: (text: string) => void;
  isSpeechSupported: boolean;
};

export function ChatMessages({ messages, isSending, onSpeak, isSpeechSupported }: ChatMessagesProps) {
  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-2xl font-semibold text-white">Haruko Voice Chat</p>
          <p className="mt-3 max-w-md text-sm leading-6 text-white/55">
            ローカルの Ollama と会話できます。テキスト入力か音声入力で始めてください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-y-auto p-4 sm:p-6">
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            "max-w-[86%] border px-4 py-3 text-sm leading-6",
            message.role === "user"
              ? "ml-auto border-emerald-300/30 bg-emerald-300/10 text-emerald-50"
              : "mr-auto border-white/10 bg-white/[0.05] text-white",
          )}
        >
          <div className="mb-1 flex items-center justify-between gap-3 text-xs text-white/45">
            <span>{message.role === "user" ? "You" : "Haruko"}</span>
            {message.role === "assistant" ? (
              <button
                type="button"
                disabled={!isSpeechSupported}
                onClick={() => onSpeak(message.contentText)}
                className="border border-white/10 px-2 py-1 text-white/70 hover:border-emerald-300/40 hover:text-emerald-100 disabled:cursor-not-allowed disabled:text-white/25"
              >
                読上
              </button>
            ) : null}
          </div>
          <p className="whitespace-pre-wrap">{message.contentText}</p>
        </div>
      ))}
      {isSending ? (
        <div className="mr-auto max-w-[86%] border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white/60">
          Harukoが考えています...
        </div>
      ) : null}
    </div>
  );
}
