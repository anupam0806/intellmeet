import React, { useEffect, useRef } from "react";
import { Subtitles, AlertCircle } from "lucide-react";

export interface LiveCaptionSegment {
  id: string;
  speakerId?: string;
  speakerName: string;
  text: string;
  ts: number | string;
}

interface CaptionsPanelProps {
  captions: LiveCaptionSegment[];
  isSupported: boolean;
  captionsEnabled: boolean;
  onToggleCaptions: () => void;
}

export function CaptionsPanel({
  captions,
  isSupported,
  captionsEnabled,
  onToggleCaptions,
}: CaptionsPanelProps): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [captions]);

  function formatTime(ts: number | string): string {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: "var(--surface)",
        borderLeft: "1px solid var(--rule)",
        color: "var(--ink)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid var(--rule)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Subtitles size={18} style={{ color: "var(--signal)" }} />
          <span style={{ fontSize: "14px", fontWeight: 600 }}>Live Captions</span>
        </div>

        {isSupported && (
          <button
            type="button"
            onClick={onToggleCaptions}
            style={{
              padding: "4px 10px",
              fontSize: "12px",
              fontWeight: 600,
              borderRadius: "3px",
              border: "1px solid var(--rule)",
              backgroundColor: captionsEnabled ? "var(--signal)" : "transparent",
              color: captionsEnabled ? "var(--on-signal)" : "var(--ink)",
              cursor: "pointer",
            }}
          >
            {captionsEnabled ? "Captions On" : "Turn On"}
          </button>
        )}
      </div>

      {/* Unsupported browser notice */}
      {!isSupported && (
        <div
          data-testid="unsupported-browser-notice"
          style={{
            margin: "12px 16px",
            padding: "10px 12px",
            backgroundColor: "var(--ground)",
            border: "1px solid var(--error)",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "12px",
            color: "var(--error)",
          }}
        >
          <AlertCircle size={16} style={{ color: "var(--error)", flexShrink: 0 }} />
          <span>Live captions need Chrome or Edge.</span>
        </div>
      )}

      {/* Captions list with aria-live="polite" */}
      <div
        ref={scrollRef}
        aria-live="polite"
        data-testid="captions-container"
        style={{
          flex: 1,
          padding: "16px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {captions.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "var(--ink-soft)",
              fontSize: "12px",
              marginTop: "40px",
              lineHeight: 1.6,
            }}
          >
            No speech transcribed yet.
            <br />
            Spoken words from participants with captions turned on will appear here in real time.
          </div>
        ) : (
          captions.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                backgroundColor: "var(--ground)",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid var(--rule)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "11px",
                  color: "var(--ink-soft)",
                }}
              >
                <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
                  {c.speakerName}
                </strong>
                <span>{formatTime(c.ts)}</span>
              </div>
              <p
                style={{
                  margin: "4px 0 0 0",
                  fontSize: "14px",
                  lineHeight: 1.5,
                  fontFamily: "var(--font-serif)",
                  color: "var(--ink)",
                }}
              >
                {c.text}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

