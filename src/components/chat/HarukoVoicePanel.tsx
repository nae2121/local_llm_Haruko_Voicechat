"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import type { VoiceState } from "@/features/voice/types";
import { cn } from "@/lib/utils";

const labels: Record<VoiceState, string> = {
  disabled: "音声会話は停止中",
  idle: "話しかけてね",
  listening: "聞いてるよ",
  processing: "考え中だよ！",
  speaking: "話してるよ！",
  error: "接続が止まりました",
};

type HarukoVoicePanelProps = {
  state: VoiceState;
  level: number;
  error: string | null;
  isSupported: boolean;
  onStart: () => void;
  onStop: () => void;
  onReconnect: () => void;
};

export function HarukoVoicePanel({
  state,
  level,
  error,
  isSupported,
  onStart,
  onStop,
  onReconnect,
}: HarukoVoicePanelProps) {
  const active = state !== "disabled" && state !== "error";
  const bars = Array.from({ length: 18 }, (_, index) => {
    const wave = 0.35 + Math.abs(Math.sin(index * 0.8)) * 0.65;
    return Math.max(3, Math.round(4 + level * wave * 28));
  });

  return (
    <section className="border-b border-white/10 bg-[radial-gradient(circle_at_center,rgba(52,211,153,0.08),transparent_65%)] px-4 py-4">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-6">
        <div
          className={cn("haruko-stage", `haruko-${state}`)}
          style={{ "--voice-level": level } as CSSProperties}
        >
          <div className="haruko-ring" />
          <Image
            src="/haruko.png"
            alt="HARUKO"
            width={180}
            height={180}
            priority
            className="haruko-image"
          />
        </div>
        <div className="min-w-0 text-center sm:text-left">
          <p className="text-sm font-semibold text-emerald-100">{labels[state]}</p>
          <div className="mt-2 flex h-9 items-center justify-center gap-1 sm:justify-start" aria-hidden>
            {bars.map((height, index) => (
              <span
                key={index}
                className="w-1 rounded-full bg-emerald-300/70 transition-[height] duration-75"
                style={{ height }}
              />
            ))}
          </div>
          {error ? <p className="mt-2 max-w-md text-xs text-red-200">{error}</p> : null}
          <div className="mt-3 flex justify-center gap-2 sm:justify-start">
            {state === "error" ? (
              <button type="button" onClick={onReconnect} className="voice-control voice-control-primary">
                再接続
              </button>
            ) : active ? (
              <button type="button" onClick={onStop} className="voice-control">
                音声会話を停止
              </button>
            ) : (
              <button
                type="button"
                onClick={onStart}
                disabled={!isSupported}
                className="voice-control voice-control-primary"
              >
                音声会話を開始
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
