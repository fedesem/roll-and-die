import { createPortal } from "react-dom";

import type { ChatMessage } from "@shared/types";

import { ChatPanel } from "../../components/ChatPanel";

interface BoardFloatingChatPortalProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSend: (text: string) => Promise<void>;
}

export function BoardFloatingChatPortal({ messages, currentUserId, onSend }: BoardFloatingChatPortalProps) {
  if (typeof document === "undefined") {
    return null;
  }

  const lastMessageId = messages[messages.length - 1]?.id ?? "empty";

  return createPortal(
    <div className="fixed right-4 top-20 bottom-4 z-[80] w-[min(290px,calc(100vw-2rem))] min-h-0">
      <ChatPanel key={`floating-chat-${lastMessageId}`} messages={messages} currentUserId={currentUserId} onSend={onSend} alwaysFollowLatest />
    </div>,
    document.body
  );
}
