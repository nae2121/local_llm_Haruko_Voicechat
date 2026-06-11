"use client";

import { FormEvent, useEffect, useState } from "react";
import type { ModelConfig } from "@/features/chat/types";

type ModelConfigPanelProps = {
  configs: ModelConfig[];
  selectedConfig?: ModelConfig;
  selectedConfigId: string | null;
  onSelect: (id: string) => void;
  onSave: (config: Omit<ModelConfig, "createdAt" | "updatedAt">) => Promise<void | ModelConfig>;
};

const emptyConfig = {
  id: "",
  name: "Haruko custom",
  llmModel: "gemma4:12b",
  temperature: 1,
  topP: 0.95,
  topK: 64,
  maxTokens: 2048,
  systemPrompt:
    "あなたはHarukoという日本語で自然に会話するローカルAIアシスタントです。短く、やさしく、会話らしく返答してください。",
  isDefault: false,
};

export function ModelConfigPanel({
  configs,
  selectedConfig,
  selectedConfigId,
  onSelect,
  onSave,
}: ModelConfigPanelProps) {
  const [form, setForm] = useState(emptyConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
    setMessage(null);
    try {
      await onSave(form);
      setMessage("保存しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <aside className="border-t border-white/10 bg-black/75 p-4 lg:w-80 lg:border-l lg:border-t-0">
      <div className="mb-4">
        <p className="text-sm font-semibold text-white">Model Config</p>
        <p className="text-xs text-white/40">Ollama / Gemma settings</p>
      </div>

      <label className="mb-4 block text-xs text-white/60">
        Preset
        <select
          value={selectedConfigId ?? ""}
          onChange={(event) => onSelect(event.target.value)}
          className="mt-2 w-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-emerald-300/60"
        >
          {configs.map((config) => (
            <option key={config.id} value={config.id} className="bg-black text-white">
              {config.name}
            </option>
          ))}
        </select>
      </label>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-xs text-white/60">
          Name
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            className="mt-1 w-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-emerald-300/60"
          />
        </label>
        <label className="block text-xs text-white/60">
          Model
          <input
            value={form.llmModel}
            onChange={(event) => setForm((current) => ({ ...current, llmModel: event.target.value }))}
            className="mt-1 w-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-emerald-300/60"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Temperature" value={form.temperature} step={0.1} onChange={(temperature) => setForm((current) => ({ ...current, temperature }))} />
          <NumberField label="Top P" value={form.topP} step={0.01} onChange={(topP) => setForm((current) => ({ ...current, topP }))} />
          <NumberField label="Top K" value={form.topK} step={1} onChange={(topK) => setForm((current) => ({ ...current, topK }))} />
          <NumberField label="Max tokens" value={form.maxTokens} step={1} onChange={(maxTokens) => setForm((current) => ({ ...current, maxTokens }))} />
        </div>
        <label className="block text-xs text-white/60">
          System prompt
          <textarea
            value={form.systemPrompt}
            rows={5}
            onChange={(event) => setForm((current) => ({ ...current, systemPrompt: event.target.value }))}
            className="mt-1 w-full resize-none border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-emerald-300/60"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-white/60">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(event) => setForm((current) => ({ ...current, isDefault: event.target.checked }))}
            className="h-4 w-4 accent-emerald-300"
          />
          Default config
        </label>
        <button
          type="submit"
          disabled={isSaving}
          className="w-full bg-emerald-300 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-200 disabled:bg-white/10 disabled:text-white/35"
        >
          {isSaving ? "保存中" : "Save config"}
        </button>
        {message ? <p className="text-xs text-white/55">{message}</p> : null}
      </form>
    </aside>
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
        className="mt-1 w-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-emerald-300/60"
      />
    </label>
  );
}
