"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { ChatEmotion, ChatMessage, ModelConfig } from "@/features/chat/types";
import { HarukoImage } from "@/components/chat/HarukoImage";
import { useChat } from "@/features/chat/hooks/useChat";
import { useContinuousVoiceChat } from "@/features/voice/hooks/useContinuousVoiceChat";
import { useLocalSpeechSynthesis } from "@/features/voice/hooks/useLocalSpeechSynthesis";
import type { VoiceState } from "@/features/voice/types";
import { cn } from "@/lib/utils";

type InteractionMode = "voice" | "text";

const stateLabels: Record<VoiceState, string> = {
  disabled: "待機中",
  idle: "話しかけてください",
  listening: "聞いています",
  processing: "考えています",
  speaking: "HARUKOが話しています",
  error: "接続が止まりました",
};

export function ChatLayout() {
  const chat = useChat();
  const localTts = useLocalSpeechSynthesis();
  const { sendMessage } = chat;
  const { speak, outputLevel, isSpeaking, synthesizingMessageId } = localTts;
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("voice");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const [activeHarukoEmotion, setActiveHarukoEmotion] = useState<ChatEmotion>("neutral");
  const [speechVisibleMessageIds, setSpeechVisibleMessageIds] = useState<Set<string>>(() => new Set());
  const lastSpokenMessageIdRef = useRef<string | null>(null);
  const voiceResponsePendingRef = useRef(false);

  const revealAssistantMessage = useCallback((message: ChatMessage) => {
    setActiveHarukoEmotion(message.emotion ?? "neutral");
    setSpeechVisibleMessageIds((current) => {
      if (current.has(message.id)) {
        return current;
      }
      return new Set(current).add(message.id);
    });
  }, []);

  const processVoiceAudio = useCallback(
    async (file: File) => {
      voiceResponsePendingRef.current = true;
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as { text?: string; error?: string };
      if (!response.ok) {
        voiceResponsePendingRef.current = false;
        throw new Error(data.error ?? "文字起こしに失敗しました。");
      }
      const transcript = data.text?.trim();
      if (!transcript) {
        voiceResponsePendingRef.current = false;
        throw new Error("文字起こし結果が空でした。");
      }

      setActiveHarukoEmotion("neutral");
      const assistantMessage = await sendMessage(transcript);
      if (!assistantMessage) {
        voiceResponsePendingRef.current = false;
      }
      return assistantMessage;
    },
    [sendMessage],
  );

  const speakVoiceResponse = useCallback(
    async (message: ChatMessage) => {
      lastSpokenMessageIdRef.current = message.id;
      voiceResponsePendingRef.current = false;
      await speak(message, {
        onPlaybackStart: () => revealAssistantMessage(message),
      });
      revealAssistantMessage(message);
    },
    [revealAssistantMessage, speak],
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

  useEffect(() => {
    if (interactionMode === "text" && continuousVoice.state !== "disabled") {
      void continuousVoice.stop();
    }
  }, [continuousVoice.state, continuousVoice.stop, interactionMode]);

  const latestUserMessage = useMemo(
    () => [...chat.messages].reverse().find((message) => message.role === "user"),
    [chat.messages],
  );
  const latestAssistantMessage = useMemo(
    () => [...chat.messages].reverse().find((message) => message.role === "assistant"),
    [chat.messages],
  );
  const displayVoiceState =
    continuousVoice.state === "speaking" && !isSpeaking ? "processing" : continuousVoice.state;
  const activeLevel = displayVoiceState === "speaking" ? outputLevel : continuousVoice.inputLevel;
  const statusLabel = interactionMode === "text" ? "テキストモード" : stateLabels[displayVoiceState];
  const shouldWaitForSpeechText =
    autoSpeak &&
    latestAssistantMessage !== undefined &&
    !speechVisibleMessageIds.has(latestAssistantMessage.id);
  const isAssistantOutputActive =
    autoSpeak &&
    latestAssistantMessage !== undefined &&
    (shouldWaitForSpeechText ||
      synthesizingMessageId === latestAssistantMessage.id ||
      isSpeaking);

  useEffect(() => {
    if (latestAssistantMessage && !shouldWaitForSpeechText) {
      setActiveHarukoEmotion(latestAssistantMessage.emotion ?? "neutral");
    }
  }, [latestAssistantMessage, shouldWaitForSpeechText]);

  const handleSend = async (message: string) => {
    setActiveHarukoEmotion("neutral");
    await chat.sendMessage(message);
  };

  const handleVoiceToggle = () => {
    if (interactionMode === "text") {
      setInteractionMode("voice");
      return;
    }
    if (continuousVoice.state === "error") {
      void continuousVoice.reconnect();
      return;
    }
    if (continuousVoice.state === "disabled") {
      void continuousVoice.start();
      return;
    }
    void continuousVoice.stop();
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#050713] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(0,153,255,0.28),transparent_28%),radial-gradient(circle_at_76%_18%,rgba(235,48,255,0.24),transparent_28%),linear-gradient(120deg,rgba(61,255,119,0.14),transparent_36%,rgba(60,118,255,0.16))]" />
      <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(120deg,transparent_0_18%,rgba(0,198,255,0.42)_18.5%,transparent_19.1%_42%,rgba(150,255,40,0.42)_42.4%,transparent_43%),linear-gradient(100deg,transparent_0_58%,rgba(234,51,255,0.34)_58.4%,transparent_59%)] [background-size:360px_220px,520px_280px]" />

      <header className="relative z-20 flex h-20 items-center justify-between border-b border-white/12 bg-black/55 px-4 backdrop-blur md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <LogoMark />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-normal">HARUKO</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-lime-200">
              <span className="h-2.5 w-2.5 rounded-full bg-lime-300 shadow-[0_0_16px_rgba(163,255,42,0.95)]" />
              <span>{interactionMode === "voice" ? "常時音声モード" : "テキストモード"}</span>
            </div>
          </div>
        </div>
        <nav className="flex items-center gap-2 sm:gap-5">
          <IconButton
            label={interactionMode === "voice" && continuousVoice.state !== "disabled" ? "ミュート" : "音声"}
            onClick={handleVoiceToggle}
          >
            <MicIcon muted={interactionMode === "text" || continuousVoice.state === "disabled"} />
          </IconButton>
          <IconButton label="設定" onClick={() => setIsSettingsOpen(true)}>
            <GearIcon />
          </IconButton>
        </nav>
      </header>

      <section className="relative z-10 flex min-h-[calc(100dvh-5rem)] flex-col">
        <div className="relative min-h-0 flex-1">
          <HarukoImage emotion={activeHarukoEmotion} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#050713]/85" />
        </div>

        <div className="relative z-20 px-3 pb-4 md:px-6">
          {chat.error || localTts.error || continuousVoice.error ? (
            <div className="mx-auto mb-3 max-w-6xl border border-red-300/25 bg-red-950/55 px-4 py-2 text-sm text-red-100 backdrop-blur">
              {chat.error ?? localTts.error ?? continuousVoice.error}
            </div>
          ) : null}

          <div className="mx-auto grid max-w-7xl gap-4 border border-white/15 bg-black/72 p-4 shadow-[0_0_36px_rgba(111,255,34,0.18)] backdrop-blur-xl md:grid-cols-[1fr_280px_1fr] md:p-6">
            <MessagePane
              title="あなた"
              accent="lime"
              body={draftMessage || latestUserMessage?.contentText || ""}
            >
              <TextComposer
                disabled={chat.isSending || isAssistantOutputActive}
                message={draftMessage}
                onMessageChange={setDraftMessage}
                onSend={handleSend}
              />
            </MessagePane>

            <div className="flex min-w-0 flex-col items-center justify-center gap-3 border-y border-white/12 py-4 md:border-x md:border-y-0 md:py-0">
              <p className="flex items-center gap-2 text-lg font-semibold text-lime-300">
                <span className="h-2.5 w-2.5 rounded-full bg-lime-300" />
                {statusLabel}
              </p>
              <VoiceDial
                state={continuousVoice.state}
                level={activeLevel}
                disabled={!continuousVoice.isSupported || interactionMode === "text"}
                onClick={handleVoiceToggle}
              />
              <VoiceBars level={activeLevel} />
              <div className="flex gap-1.5" aria-hidden>
                {[0, 1, 2, 3].map((item) => (
                  <span
                    key={item}
                    className={cn(
                      "h-2 w-2 rounded-full",
                      item === 0 ? "bg-lime-300" : "bg-white/25",
                    )}
                  />
                ))}
              </div>
            </div>

            <MessagePane
              title="HARUKO"
              accent="pink"
              body={
                chat.isSending
                  ? "考えています..."
                  : shouldWaitForSpeechText
                    ? ""
                    : latestAssistantMessage?.contentText ?? ""
              }
            />
          </div>

          <p className="mx-auto mt-2 max-w-7xl text-right text-[11px] text-white/45">
            Voice: COEIROINK: 蔓歌せら（げんき！）
          </p>
        </div>
      </section>

      {isSettingsOpen ? (
        <SettingsDialog
          autoSpeak={autoSpeak}
          interactionMode={interactionMode}
          configs={chat.modelConfigs}
          selectedConfig={chat.selectedModelConfig}
          selectedConfigId={chat.selectedModelConfigId}
          onAutoSpeakChange={setAutoSpeak}
          onModeChange={setInteractionMode}
          onSelectConfig={chat.setSelectedModelConfigId}
          onSaveConfig={chat.saveModelConfig}
          onClose={() => setIsSettingsOpen(false)}
        />
      ) : null}
    </main>
  );
}

function TextComposer({
  disabled,
  message,
  onMessageChange,
  onSend,
}: {
  disabled: boolean;
  message: string;
  onMessageChange: (message: string) => void;
  onSend: (message: string) => Promise<void>;
}) {
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = message.trim();
    if (!text || disabled) {
      return;
    }
    onMessageChange("");
    await onSend(text);
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex items-end gap-2">
      <textarea
        value={message}
        onChange={(event) => onMessageChange(event.target.value)}
        disabled={disabled}
        placeholder="メッセージを入力"
        rows={4}
        className="min-h-28 flex-1 resize-y border border-lime-300/25 bg-white/[0.06] px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-white/35 focus:border-lime-300/70 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled || !message.trim()}
        className="h-28 shrink-0 border border-lime-300/45 bg-lime-300 px-4 text-sm font-bold text-black transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-white/35"
      >
        {disabled ? "待機中" : "送信"}
      </button>
    </form>
  );
}

function MessagePane({
  title,
  accent,
  body,
  children,
}: {
  title: string;
  accent: "lime" | "pink";
  body: string;
  children?: ReactNode;
}) {
  const isLime = accent === "lime";
  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-center gap-3">
        <span
          className={cn(
            "grid h-10 w-10 place-items-center rounded-full border",
            isLime
              ? "border-lime-300/50 text-lime-300"
              : "border-fuchsia-300/50 text-fuchsia-300",
          )}
        >
          {isLime ? <UserIcon /> : <StarIcon />}
        </span>
        <p className={cn("text-sm font-bold", isLime ? "text-lime-300" : "text-fuchsia-300")}>
          {title}
        </p>
      </div>
      <p className="min-h-16 whitespace-pre-wrap text-lg font-semibold leading-8 text-white md:text-xl">
        <span className={cn(isLime ? "text-lime-300" : "text-fuchsia-300")}>{title}: </span>
        {body}
      </p>
      {children}
    </section>
  );
}

function VoiceDial({
  state,
  level,
  disabled,
  onClick,
}: {
  state: VoiceState;
  level: number;
  disabled: boolean;
  onClick: () => void;
}) {
  const active = !disabled && state !== "disabled";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative grid h-32 w-32 place-items-center rounded-full border transition",
        active
          ? "border-lime-300 bg-lime-300/12 text-lime-300 shadow-[0_0_34px_rgba(163,255,42,0.6)]"
          : "border-white/20 bg-white/5 text-white/50",
        disabled ? "cursor-not-allowed opacity-50" : "hover:scale-[1.02]",
      )}
      style={{ boxShadow: active ? `0 0 ${24 + level * 42}px rgba(163,255,42,0.72)` : undefined }}
      aria-label="音声入力を切り替え"
    >
      <span className="absolute inset-3 rounded-full border border-current/30" />
      <MicIcon muted={!active} large />
    </button>
  );
}

function VoiceBars({ level }: { level: number }) {
  const bars = Array.from({ length: 20 }, (_, index) => {
    const wave = 0.35 + Math.abs(Math.sin(index * 0.75)) * 0.65;
    return Math.max(8, Math.round(10 + level * wave * 42));
  });

  return (
    <div className="flex h-12 items-center justify-center gap-1" aria-hidden>
      {bars.map((height, index) => (
        <span
          key={index}
          className="w-1 rounded-full bg-lime-300/75 transition-[height] duration-75"
          style={{ height }}
        />
      ))}
    </div>
  );
}

function SettingsDialog({
  autoSpeak,
  interactionMode,
  configs,
  selectedConfig,
  selectedConfigId,
  onAutoSpeakChange,
  onModeChange,
  onSelectConfig,
  onSaveConfig,
  onClose,
}: {
  autoSpeak: boolean;
  interactionMode: InteractionMode;
  configs: ModelConfig[];
  selectedConfig?: ModelConfig;
  selectedConfigId: string | null;
  onAutoSpeakChange: (value: boolean) => void;
  onModeChange: (value: InteractionMode) => void;
  onSelectConfig: (id: string) => void;
  onSaveConfig: (config: Omit<ModelConfig, "createdAt" | "updatedAt">) => Promise<void | ModelConfig>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    id: selectedConfig?.id ?? "",
    name: selectedConfig?.name ?? "Haruko custom",
    llmModel: selectedConfig?.llmModel ?? "gemma4:12b",
    temperature: selectedConfig?.temperature ?? 1,
    topP: selectedConfig?.topP ?? 0.95,
    topK: selectedConfig?.topK ?? 64,
    maxTokens: selectedConfig?.maxTokens ?? 256,
    systemPrompt: selectedConfig?.systemPrompt ?? "",
    isDefault: selectedConfig?.isDefault ?? false,
  });
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (selectedConfig) {
      setForm({
        id: selectedConfig.id,
        name: selectedConfig.name,
        llmModel: selectedConfig.llmModel,
        temperature: selectedConfig.temperature,
        topP: selectedConfig.topP,
        topK: selectedConfig.topK,
        maxTokens: selectedConfig.maxTokens,
        systemPrompt: selectedConfig.systemPrompt,
        isDefault: selectedConfig.isDefault,
      });
    }
  }, [selectedConfig]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await onSaveConfig(form);
      setSaveMessage("保存しました。");
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/72 p-4 backdrop-blur">
      <section className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto border border-white/15 bg-[#070914] p-5 shadow-[0_0_40px_rgba(68,255,140,0.18)]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">設定</h2>
            <p className="mt-1 text-sm text-white/50">システムプロンプト、読み上げ、入力モードを調整できます。</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center border border-white/15 text-white/70 hover:border-lime-300/45 hover:text-lime-200"
            aria-label="設定を閉じる"
          >
            ×
          </button>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <SettingSwitch label="自動読み上げ" checked={autoSpeak} onChange={onAutoSpeakChange} />
          <div className="border border-white/10 bg-white/[0.04] p-3">
            <p className="mb-2 text-xs font-semibold text-white/60">入力モード</p>
            <div className="grid grid-cols-2 border border-white/10">
              <button
                type="button"
                onClick={() => onModeChange("voice")}
                className={cn("px-3 py-2 text-sm font-semibold", interactionMode === "voice" ? "bg-lime-300 text-black" : "text-white/65")}
              >
                会話
              </button>
              <button
                type="button"
                onClick={() => onModeChange("text")}
                className={cn("px-3 py-2 text-sm font-semibold", interactionMode === "text" ? "bg-lime-300 text-black" : "text-white/65")}
              >
                テキスト
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-xs text-white/60">
            プリセット
            <select
              value={selectedConfigId ?? ""}
              onChange={(event) => onSelectConfig(event.target.value)}
              className="mt-2 w-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-lime-300/70"
            >
              {configs.map((config) => (
                <option key={config.id} value={config.id} className="bg-black text-white">
                  {config.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-white/60">
            システムプロンプト
            <textarea
              value={form.systemPrompt}
              rows={10}
              onChange={(event) => setForm((current) => ({ ...current, systemPrompt: event.target.value }))}
              className="mt-2 w-full resize-y border border-white/10 bg-white/[0.04] px-3 py-2 text-sm leading-6 text-white outline-none focus:border-lime-300/70"
            />
          </label>

          <details className="border border-white/10 bg-white/[0.03] p-3">
            <summary className="cursor-pointer text-sm font-semibold text-white/75">詳細モデル設定</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <SmallTextField label="名前" value={form.name} onChange={(name) => setForm((current) => ({ ...current, name }))} />
              <SmallTextField label="モデル" value={form.llmModel} onChange={(llmModel) => setForm((current) => ({ ...current, llmModel }))} />
              <NumberField label="Temperature" value={form.temperature} step={0.1} onChange={(temperature) => setForm((current) => ({ ...current, temperature }))} />
              <NumberField label="Top P" value={form.topP} step={0.01} onChange={(topP) => setForm((current) => ({ ...current, topP }))} />
              <NumberField label="Top K" value={form.topK} step={1} onChange={(topK) => setForm((current) => ({ ...current, topK }))} />
              <NumberField label="Max tokens" value={form.maxTokens} step={1} onChange={(maxTokens) => setForm((current) => ({ ...current, maxTokens }))} />
            </div>
          </details>

          <div className="border border-white/10 bg-black/35 p-3 text-xs leading-5 text-white/55">
            <p className="font-semibold text-white/75">権利表記</p>
            <p className="mt-1">
              音声合成: COEIROINK: 蔓歌せら（げんき！） / こえいろプロジェクト。使用している話者・音声・キャラクター素材の著作権および隣接する権利は各権利者に帰属します。
            </p>
            <a href="https://coeiroink.com/" target="_blank" rel="noreferrer" className="mt-2 inline-block text-lime-200 hover:text-lime-100">
              COEIROINK 公式サイト
            </a>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-white/50">{saveMessage}</p>
            <button
              type="submit"
              disabled={isSaving}
              className="border border-lime-300/45 bg-lime-300 px-5 py-2 text-sm font-bold text-black hover:bg-lime-200 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-white/35"
            >
              {isSaving ? "保存中" : "保存"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function SettingSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 border border-white/10 bg-white/[0.04] p-3 text-sm font-semibold text-white/75">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 accent-lime-300"
      />
    </label>
  );
}

function SmallTextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs text-white/60">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-lime-300/60"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-xs text-white/60">
      {label}
      <input
        type="number"
        value={value}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-lime-300/60"
      />
    </label>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-1 text-xs font-semibold text-white/80"
      aria-label={label}
    >
      <span className="grid h-12 w-12 place-items-center rounded-full border border-white/25 bg-black/35 transition group-hover:border-lime-300/60 group-hover:text-lime-200">
        {children}
      </span>
      <span>{label}</span>
    </button>
  );
}

function LogoMark() {
  return (
    <span className="flex h-11 w-9 items-center justify-center gap-1 text-lime-300" aria-hidden>
      {[18, 31, 23, 39, 16].map((height, index) => (
        <span key={index} className="w-1 rounded-full bg-current" style={{ height }} />
      ))}
    </span>
  );
}

function MicIcon({ muted = false, large = false }: { muted?: boolean; large?: boolean }) {
  const size = large ? 54 : 24;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 15a4 4 0 0 0 4-4V6a4 4 0 0 0-8 0v5a4 4 0 0 0 4 4Z" stroke="currentColor" strokeWidth="2" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {muted ? <path d="M4 4l16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /> : null}
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M19.4 13.5c.1-.5.1-1 .1-1.5s0-1-.1-1.5l2-1.5-2-3.5-2.4 1a8.4 8.4 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A8.4 8.4 0 0 0 7 6.5l-2.4-1-2 3.5 2 1.5c-.1.5-.1 1-.1 1.5s0 1 .1 1.5l-2 1.5 2 3.5 2.4-1a8.4 8.4 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a8.4 8.4 0 0 0 2.6-1.5l2.4 1 2-3.5-2-1.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="m12 2 2.9 6 6.6.9-4.8 4.7 1.1 6.6L12 17.1l-5.8 3.1 1.1-6.6-4.8-4.7 6.6-.9L12 2Z" />
    </svg>
  );
}
