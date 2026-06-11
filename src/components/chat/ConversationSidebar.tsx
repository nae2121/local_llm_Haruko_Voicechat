"use client";

import type { ConversationSummary } from "@/features/chat/types";
import { cn } from "@/lib/utils";

type ConversationSidebarProps = {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
};

export function ConversationSidebar({
  conversations,
  activeConversationId,
  onSelect,
  onNew,
}: ConversationSidebarProps) {
  return (
    <aside className="flex h-full flex-col border-b border-white/10 bg-black/80 md:w-72 md:border-b-0 md:border-r">
      <div className="flex items-center justify-between border-b border-white/10 p-4">
        <div>
          <p className="text-sm font-semibold text-white">Conversations</p>
          <p className="text-xs text-white/40">local history</p>
        </div>
        <button
          type="button"
          onClick={onNew}
          className="border border-emerald-300/35 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-300/10"
        >
          New
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto p-3 md:flex-1 md:flex-col md:overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="p-2 text-sm text-white/40">まだ会話はありません。</p>
        ) : (
          conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => onSelect(conversation.id)}
              className={cn(
                "min-w-56 border px-3 py-3 text-left transition md:min-w-0",
                activeConversationId === conversation.id
                  ? "border-emerald-300/50 bg-emerald-300/10"
                  : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]",
              )}
            >
              <p className="truncate text-sm font-medium text-white">{conversation.title}</p>
              <p className="mt-1 truncate text-xs text-white/40">
                {conversation.messages?.[0]?.contentText ?? "会話を開く"}
              </p>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
