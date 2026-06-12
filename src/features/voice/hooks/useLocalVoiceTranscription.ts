"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type TranscribeResponse = {
  transcript?: string;
  error?: string;
};

export function useLocalVoiceTranscription(onTranscript: (text: string) => void) {
  const [isSupported, setIsSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setIsSupported(Boolean(navigator.mediaDevices?.getUserMedia) && "MediaRecorder" in window);
  }, []);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  const transcribeBlob = useCallback(
    async (blob: Blob) => {
      setIsTranscribing(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("file", blob, "recording.webm");
        const response = await fetch("/api/voice/transcribe", {
          method: "POST",
          body: formData,
        });
        const data = (await response.json()) as TranscribeResponse;
        if (!response.ok || !data.transcript) {
          throw new Error(data.error ?? "文字起こしに失敗しました。");
        }
        onTranscript(data.transcript);
      } catch (transcribeError) {
        setError(transcribeError instanceof Error ? transcribeError.message : "文字起こしに失敗しました。");
      } finally {
        setIsTranscribing(false);
      }
    },
    [onTranscript],
  );

  const start = useCallback(async () => {
    if (!isSupported) {
      setError("録音はこのブラウザで利用できません。");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        setIsRecording(false);
        cleanupStream();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 0) {
          void transcribeBlob(blob);
        }
      };
      setError(null);
      setIsRecording(true);
      recorder.start();
    } catch (recordError) {
      cleanupStream();
      setIsRecording(false);
      setError(recordError instanceof Error ? recordError.message : "録音を開始できませんでした。");
    }
  }, [cleanupStream, isSupported, transcribeBlob]);

  const stop = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }, []);

  const toggle = useCallback(() => {
    if (isRecording) {
      stop();
    } else {
      void start();
    }
  }, [isRecording, start, stop]);

  return {
    isSupported,
    isRecording,
    isTranscribing,
    error,
    start,
    stop,
    toggle,
  };
}
