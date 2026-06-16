"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ChatMessage } from "@/features/chat/types";
import type { VoiceState } from "@/features/voice/types";
import { recordedBlobToWav } from "@/features/voice/audio";

const SILENCE_MS = 1_000;
const MAX_RECORDING_MS = 30_000;
const MIN_RECORDING_MS = 300;

const subscribeToBrowserCapabilities = () => () => undefined;
const getVoiceSupportSnapshot = () =>
  Boolean(navigator.mediaDevices?.getUserMedia) && "MediaRecorder" in window;
const getServerVoiceSupportSnapshot = () => false;

type ContinuousVoiceOptions = {
  processAudio: (file: File) => Promise<ChatMessage | null>;
  speak: (message: ChatMessage) => Promise<void>;
};

export function useContinuousVoiceChat({ processAudio, speak }: ContinuousVoiceOptions) {
  const [state, setState] = useState<VoiceState>("disabled");
  const [inputLevel, setInputLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const isSupported = useSyncExternalStore(
    subscribeToBrowserCapabilities,
    getVoiceSupportSnapshot,
    getServerVoiceSupportSnapshot,
  );
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const frameRef = useRef<number | null>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeResolveRef = useRef<(() => void) | null>(null);
  const activeRef = useRef(false);
  const processingRef = useRef(false);
  const discardRecordingRef = useRef(false);
  const recordingStartedAtRef = useRef(0);
  const silenceStartedAtRef = useRef<number | null>(null);
  const speechFramesRef = useRef(0);
  const noiseFloorRef = useRef(0.008);
  const processAudioRef = useRef(processAudio);
  const speakRef = useRef(speak);

  useEffect(() => {
    processAudioRef.current = processAudio;
    speakRef.current = speak;
  }, [processAudio, speak]);

  const clearScheduledWork = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    resumeResolveRef.current?.();
    resumeResolveRef.current = null;
  }, []);

  const releaseResources = useCallback(async () => {
    activeRef.current = false;
    processingRef.current = false;
    clearScheduledWork();
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder?.state === "recording") {
      recorder.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    const context = contextRef.current;
    contextRef.current = null;
    if (context && context.state !== "closed") {
      await context.close().catch(() => undefined);
    }
    chunksRef.current = [];
    setInputLevel(0);
  }, [clearScheduledWork]);

  const enterError = useCallback(
    async (reason: unknown) => {
      await releaseResources();
      setError(reason instanceof Error ? reason.message : "音声会話でエラーが発生しました。");
      setState("error");
    },
    [releaseResources],
  );

  const scheduleDetection = useCallback(() => {
    const analyser = analyserRef.current;
    const recorder = recorderRef.current;
    if (!activeRef.current || !analyser || !recorder || processingRef.current) {
      return;
    }

    const samples = new Float32Array(analyser.fftSize);
    const detect = () => {
      if (!activeRef.current || processingRef.current) {
        return;
      }
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) {
        sum += sample * sample;
      }
      const rms = Math.sqrt(sum / samples.length);
      const visualLevel = Math.min(1, rms * 12);
      setInputLevel(visualLevel);

      const threshold = Math.max(0.025, noiseFloorRef.current * 3);
      if (recorder.state === "inactive") {
        noiseFloorRef.current = noiseFloorRef.current * 0.98 + Math.min(rms, 0.03) * 0.02;
        speechFramesRef.current = rms > threshold ? speechFramesRef.current + 1 : 0;
        if (speechFramesRef.current >= 3) {
          chunksRef.current = [];
          silenceStartedAtRef.current = null;
          recordingStartedAtRef.current = performance.now();
          recorder.start(100);
          setState("listening");
        }
      } else {
        const now = performance.now();
        if (rms < threshold * 0.75) {
          silenceStartedAtRef.current ??= now;
        } else {
          silenceStartedAtRef.current = null;
        }
        const silenceMs = silenceStartedAtRef.current ? now - silenceStartedAtRef.current : 0;
        const recordingMs = now - recordingStartedAtRef.current;
        if (recordingMs >= MAX_RECORDING_MS || (recordingMs >= MIN_RECORDING_MS && silenceMs >= SILENCE_MS)) {
          processingRef.current = true;
          recorder.stop();
        }
      }
      frameRef.current = requestAnimationFrame(detect);
    };
    frameRef.current = requestAnimationFrame(detect);
  }, []);

  const start = useCallback(async () => {
    if (activeRef.current || processingRef.current) {
      return;
    }
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) {
        throw new Error("このブラウザは常時音声入力に対応していません。");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.2;
      source.connect(analyser);

      const preferredMimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
        (type) => MediaRecorder.isTypeSupported(type),
      );
      const recorder = new MediaRecorder(
        stream,
        preferredMimeType ? { mimeType: preferredMimeType } : undefined,
      );
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = async () => {
        if (!activeRef.current) {
          return;
        }
        if (discardRecordingRef.current) {
          discardRecordingRef.current = false;
          chunksRef.current = [];
          return;
        }
        processingRef.current = true;
        clearScheduledWork();
        setInputLevel(0);
        setState("processing");
        try {
          const recordingMs = performance.now() - recordingStartedAtRef.current;
          if (recordingMs < MIN_RECORDING_MS || chunksRef.current.length === 0) {
            throw new Error("発話が短すぎました。もう一度話してください。");
          }
          const recorded = new Blob(chunksRef.current, { type: recorder.mimeType });
          chunksRef.current = [];
          const wav = await recordedBlobToWav(recorded);
          const assistantMessage = await processAudioRef.current(
            new File([wav], `speech-${Date.now()}.wav`, { type: "audio/wav" }),
          );
          if (!assistantMessage) {
            throw new Error("音声への回答を取得できませんでした。");
          }
          if (!activeRef.current) {
            return;
          }
          setState("speaking");
          await speakRef.current(assistantMessage);
          await new Promise<void>((resolve) => {
            resumeResolveRef.current = resolve;
            resumeTimerRef.current = setTimeout(() => {
              resumeTimerRef.current = null;
              resumeResolveRef.current = null;
              resolve();
            }, 500);
          });
          if (!activeRef.current) {
            return;
          }
          processingRef.current = false;
          speechFramesRef.current = 0;
          silenceStartedAtRef.current = null;
          setState("idle");
          scheduleDetection();
        } catch (reason) {
          await enterError(reason);
        }
      };

      streamRef.current = stream;
      contextRef.current = context;
      analyserRef.current = analyser;
      recorderRef.current = recorder;
      activeRef.current = true;
      setState("idle");
      scheduleDetection();
    } catch (reason) {
      await enterError(reason);
    }
  }, [clearScheduledWork, enterError, scheduleDetection]);

  const stop = useCallback(async () => {
    await releaseResources();
    setError(null);
    setState("disabled");
  }, [releaseResources]);

  const reconnect = useCallback(async () => {
    await releaseResources();
    setState("disabled");
    await start();
  }, [releaseResources, start]);

  const playMessage = useCallback(
    async (message: ChatMessage) => {
      const context = contextRef.current;
      if (!activeRef.current || !context || processingRef.current) {
        await speakRef.current(message);
        return;
      }
      processingRef.current = true;
      clearScheduledWork();
      setInputLevel(0);
      setState("speaking");
      const recorder = recorderRef.current;
      if (recorder?.state === "recording") {
        discardRecordingRef.current = true;
        recorder.stop();
      }
      try {
        await speakRef.current(message);
        await new Promise<void>((resolve) => {
          resumeResolveRef.current = resolve;
          resumeTimerRef.current = setTimeout(() => {
            resumeTimerRef.current = null;
            resumeResolveRef.current = null;
            resolve();
          }, 500);
        });
        if (!activeRef.current) {
          return;
        }
        processingRef.current = false;
        speechFramesRef.current = 0;
        silenceStartedAtRef.current = null;
        setState("idle");
        scheduleDetection();
      } catch (reason) {
        await enterError(reason);
      }
    },
    [clearScheduledWork, enterError, scheduleDetection],
  );

  useEffect(() => {
    return () => {
      void releaseResources();
    };
  }, [releaseResources]);

  return {
    state,
    inputLevel,
    error,
    isSupported,
    start,
    stop,
    reconnect,
    playMessage,
  };
}
