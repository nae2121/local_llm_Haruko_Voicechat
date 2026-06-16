"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SynthesizeResponse = {
  audioUrl?: string;
  error?: string;
};

export function useLocalSpeechSynthesis() {
  const [synthesizingMessageId, setSynthesizingMessageId] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [outputLevel, setOutputLevel] = useState(0);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const stopMeter = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setOutputLevel(0);
  }, []);

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
      activeAudioRef.current?.pause();
      activeAudioRef.current = audio;
      const context = new AudioContext();
      const source = context.createMediaElementSource(audio);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(context.destination);
      const samples = new Uint8Array(analyser.frequencyBinCount);
      const updateMeter = () => {
        analyser.getByteFrequencyData(samples);
        const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
        setOutputLevel(Math.min(1, average / 110));
        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };
      setIsSpeaking(true);
      updateMeter();
      await audio.play();
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error("読み上げ音声を再生できませんでした。"));
      });
      await context.close();
    } catch (synthesisError) {
      setError(synthesisError instanceof Error ? synthesisError.message : "音声生成に失敗しました。");
    } finally {
      activeAudioRef.current = null;
      setIsSpeaking(false);
      stopMeter();
      setSynthesizingMessageId(null);
    }
  }, [stopMeter]);

  useEffect(() => {
    return () => {
      activeAudioRef.current?.pause();
      stopMeter();
    };
  }, [stopMeter]);

  return {
    audioUrls,
    error,
    isSpeaking,
    outputLevel,
    synthesizingMessageId,
    speak,
  };
}
