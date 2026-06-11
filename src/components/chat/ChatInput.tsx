"use client";

import { FormEvent, useCallback, useState } from "react";
import { VoiceButton } from "@/components/chat/VoiceButton";
import { useSpeechRecognition } from "@/features/voice/hooks/useSpeechRecognition";

type ChatInputProps = {
  isSending: boolean;
  onSend: (message: string) => Promise<void>;
};

export function ChatInput({ isSending, onSend }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const handleTranscript = useCallback((text: string) => {
    setMessage((current) => [current, text].filter(Boolean).join(current ? " " : ""));
  }, []);
  const speechRecognition = useSpeechRecognition(handleTranscript);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = message.trim();
    if (!text || isSending) {
      return;
    }
    setMessage("");
    await onSend(text);
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-white/10 bg-black/60 p-3 sm:p-4">
      <div className="flex items-end gap-2">
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Harukoに話しかける..."
          rows={2}
          className="min-h-11 flex-1 resize-none border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-emerald-300/70"
        />
        <VoiceButton
          isListening={speechRecognition.isListening}
          isSupported={speechRecognition.isSupported}
          onClick={speechRecognition.toggle}
        />
        <button
          type="submit"
          disabled={isSending || !message.trim()}
          className="h-11 shrink-0 bg-emerald-300 px-4 text-sm font-semibold text-black transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35"
        >
          {isSending ? "送信中" : "Send"}
        </button>
      </div>
      {speechRecognition.error ? (
        <p className="mt-2 text-xs text-red-300">{speechRecognition.error}</p>
      ) : null}
    </form>
  );
}
