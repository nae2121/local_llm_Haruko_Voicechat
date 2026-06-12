"use client";

import { cn } from "@/lib/utils";

type VoiceButtonProps = {
  isListening: boolean;
  isSupported: boolean;
  title?: string;
  onClick: () => void;
};

export function VoiceButton({ isListening, isSupported, title, onClick }: VoiceButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isSupported}
      title={title ?? (isSupported ? "音声入力" : "音声入力はこのブラウザで利用できません")}
      className={cn(
        "h-11 w-11 shrink-0 border border-emerald-300/25 text-sm font-semibold transition",
        "disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/30",
        isListening
          ? "bg-emerald-300 text-black"
          : "bg-white/5 text-emerald-100 hover:bg-emerald-300/15",
      )}
    >
      {isListening ? "Stop" : "Mic"}
    </button>
  );
}
