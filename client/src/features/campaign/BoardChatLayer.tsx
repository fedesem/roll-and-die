import { createPortal } from "react-dom";

import type { ChatMessage } from "@shared/types";

import { ChatPanel } from "../../components/ChatPanel";

interface BoardChatLayerProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSend: (text: string) => Promise<void>;
  sheetOpen: boolean;
}

export function BoardChatLayer({ messages, currentUserId, onSend, sheetOpen }: BoardChatLayerProps) {
  const content = <ChatPanel messages={messages} currentUserId={currentUserId} onSend={onSend} alwaysFollowLatest={sheetOpen} />;

  if (!sheetOpen) {
    return <aside className="table-overlay table-chat">{content}</aside>;
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed right-4 top-20 bottom-4 z-[80] w-[min(290px,calc(100vw-2rem))] min-h-0 pointer-events-auto">
      {content}
    </div>,
    document.body
  );
}
