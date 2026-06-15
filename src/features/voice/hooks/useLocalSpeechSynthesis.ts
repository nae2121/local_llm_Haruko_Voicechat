"use client";

import { useCallback, useState } from "react";

type SynthesizeResponse = {
  audioUrl?: string;
  error?: string;
};

export function useLocalSpeechSynthesis() {
  const [synthesizingMessageId, setSynthesizingMessageId] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const speak = useCallback(async (message: { id: string; contentText: string }) => {
    const text = message.contentText.trim();
    if (!text) {
      return;
    }

    setSynthesizingMessageId(message.id);
    setError(null);
    try {
      const response = await fetch("/api/voice/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: message.id, text }),
      });
      const data = (await response.json()) as SynthesizeResponse;
      if (!response.ok || !data.audioUrl) {
        throw new Error(data.error ?? "音声生成に失敗しました。");
      }

      const audioUrl = data.audioUrl;
      setAudioUrls((current) => ({ ...current, [message.id]: audioUrl }));
      const audio = new Audio(audioUrl);
      await audio.play();
    } catch (synthesisError) {
      setError(synthesisError instanceof Error ? synthesisError.message : "音声生成に失敗しました。");
    } finally {
      setSynthesizingMessageId(null);
    }
  }, []);

  return {
    audioUrls,
    error,
    synthesizingMessageId,
    speak,
  };
}
