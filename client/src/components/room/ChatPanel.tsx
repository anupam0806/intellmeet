import React, { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import type { ChatMessageItem } from "../../lib/meetings.js";

interface ChatPanelProps {
  messages: ChatMessageItem[];
  typingUsers: string[];
  onSendMessage: (text: string) => void;
  onTyping: (isTyping: boolean) => void;
}

export function ChatPanel({
  messages,
  typingUsers,
  onSendMessage,
  onTyping,
}: ChatPanelProps): React.JSX.Element {
  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft(e.target.value);

    // Broadcast typing state
    onTyping(true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 2000);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;

    onSendMessage(text);
    setDraft("");

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    onTyping(false);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: "var(--surface)",
        borderLeft: "1px solid var(--rule)",
      }}
    >
      {/* Live region for accessibility */}
      <div
        aria-live="polite"
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          border: 0,
        }}
      >
        {messages.length > 0
          ? `${messages[messages.length - 1]?.senderName}: ${messages[messages.length - 1]?.text}`
          : ""}
      </div>

      {/* Messages list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--ink-soft)",
              fontSize: "13px",
              textAlign: "center",
            }}
          >
            No messages yet. Say hello to your team.
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--ink)",
                  }}
                >
                  {msg.senderName}
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    color: "var(--ink-soft)",
                  }}
                >
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  lineHeight: "1.4",
                  color: "var(--ink)",
                  wordBreak: "break-word",
                }}
              >
                {msg.text}
              </p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div
          style={{
            padding: "4px 16px",
            fontSize: "11px",
            color: "var(--ink-soft)",
            fontStyle: "italic",
          }}
        >
          {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
        </div>
      )}

      {/* Message input */}
      <form
        onSubmit={handleSend}
        style={{
          padding: "12px 16px",
          borderTop: "1px solid var(--rule)",
          display: "flex",
          gap: "8px",
        }}
      >
        <input
          type="text"
          value={draft}
          onChange={handleInputChange}
          placeholder="Send a message..."
          maxLength={2000}
          style={{
            flex: 1,
            backgroundColor: "var(--ground)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--radius)",
            padding: "8px 12px",
            fontSize: "13px",
            color: "var(--ink)",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          style={{
            padding: "8px 12px",
            backgroundColor: draft.trim() ? "var(--ink)" : "var(--rule)",
            color: draft.trim() ? "var(--surface)" : "var(--ink-soft)",
            border: "none",
            borderRadius: "var(--radius)",
            cursor: draft.trim() ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-label="Send message"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}

