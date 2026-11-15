import React, { useEffect, useRef } from "react";
import { Subtitles, AlertCircle, Globe } from "lucide-react";
import { CAPTION_LANGUAGES } from "../../lib/captions.js";

export interface LiveCaptionSegment {
  id: string;
  speakerId?: string;
  speakerName: string;
  text: string;
  ts: number | string;
}

export interface CaptionsPanelProps {
  readonly captions: readonly LiveCaptionSegment[];
  readonly isSupported: boolean;
  readonly captionsEnabled: boolean;
  readonly onToggleCaptions: () => void;
  readonly currentLanguage?: string;
  readonly onLanguageChange?: (lang: string) => void;
  readonly interimCaption?: string;
  readonly speakerName?: string;
  readonly isMuted?: boolean;
  readonly isListening?: boolean;
  readonly errorMessage?: string | null;
}

function formatTime(ts: number | string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function getListeningStatusText(isMuted: boolean, isListening: boolean): string {
  if (isMuted) {
    return "Microphone muted — captions paused";
  }
  if (isListening) {
    return "Listening for speech...";
  }
  return "Connecting captions...";
}

function getEmptyHelpText(captionsEnabled: boolean, isMuted: boolean): string {
  if (!captionsEnabled) {
    return "Spoken words from participants with captions turned on will appear here in real time.";
  }
  if (isMuted) {
    return "Unmute your microphone and speak to transcribe speech.";
  }
  return "Speak into your microphone to transcribe speech in real time.";
}

function CaptionsHeader({
  isSupported,
  captionsEnabled,
  onToggleCaptions,
}: {
  readonly isSupported: boolean;
  readonly captionsEnabled: boolean;
  readonly onToggleCaptions: () => void;
}): React.JSX.Element {
  return (
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
  );
}

function LanguagePickerBar({
  currentLanguage,
  onLanguageChange,
}: {
  readonly currentLanguage: string;
  readonly onLanguageChange?: (lang: string) => void;
}): React.JSX.Element {
  return (
    <div
      style={{
        padding: "8px 16px",
        borderBottom: "1px solid var(--rule)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
        backgroundColor: "var(--ground)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <Globe size={14} style={{ color: "var(--ink-soft)" }} />
        <label
          htmlFor="caption-language-select"
          style={{
            fontSize: "12px",
            color: "var(--ink-soft)",
            fontWeight: 500,
          }}
        >
          Language
        </label>
      </div>
      <select
        id="caption-language-select"
        data-testid="caption-language-select"
        aria-label="Spoken language"
        value={currentLanguage}
        onChange={(e) => onLanguageChange?.(e.target.value)}
        style={{
          fontSize: "12px",
          padding: "3px 8px",
          borderRadius: "3px",
          border: "1px solid var(--rule)",
          backgroundColor: "var(--surface)",
          color: "var(--ink)",
          colorScheme: "light dark",
          cursor: "pointer",
        }}
      >
        {CAPTION_LANGUAGES.map((lang) => (
          <option
            key={lang.code}
            value={lang.code}
            style={{
              backgroundColor: "var(--surface)",
              color: "var(--ink)",
            }}
          >
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CaptionsPanel({
  captions,
  isSupported,
  captionsEnabled,
  onToggleCaptions,
  currentLanguage = "en-US",
  onLanguageChange,
  interimCaption,
  speakerName = "You",
  isMuted = false,
  isListening = false,
  errorMessage = null,
}: Readonly<CaptionsPanelProps>): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [captions, interimCaption]);

  const listeningStatusText = getListeningStatusText(isMuted, isListening);
  const emptyHelpText = getEmptyHelpText(captionsEnabled, isMuted);

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
      <CaptionsHeader
        isSupported={isSupported}
        captionsEnabled={captionsEnabled}
        onToggleCaptions={onToggleCaptions}
      />

      {isSupported && (
        <LanguagePickerBar
          currentLanguage={currentLanguage}
          onLanguageChange={onLanguageChange}
        />
      )}

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
          <span>
            {typeof window !== "undefined" && window.isSecureContext === false
              ? "Live captions require HTTPS or localhost (insecure HTTP blocked by browser)."
              : "Live captions need Chrome or Edge."}
          </span>
        </div>
      )}

      {/* Error message alert */}
      {errorMessage && (
        <div
          data-testid="caption-error-alert"
          style={{
            margin: "8px 16px",
            padding: "8px 12px",
            backgroundColor: "var(--ground)",
            border: "1px solid var(--error, #e53e3e)",
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "12px",
            color: "var(--error, #e53e3e)",
          }}
        >
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Recognition listening / paused status */}
      {captionsEnabled && isSupported && !errorMessage && (
        <div
          data-testid={isMuted ? "caption-muted-indicator" : "caption-listening-indicator"}
          style={{
            padding: "6px 16px",
            backgroundColor: "var(--ground)",
            borderBottom: "1px solid var(--rule)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "11px",
            color: isMuted ? "var(--ink-soft)" : "var(--signal)",
            fontWeight: 500,
          }}
        >
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              backgroundColor: isMuted ? "var(--ink-soft)" : "var(--signal)",
              boxShadow: isMuted ? "none" : "0 0 6px var(--signal)",
              flexShrink: 0,
            }}
          />
          <span>{listeningStatusText}</span>
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
        {captions.length === 0 && !interimCaption ? (
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
            {emptyHelpText}
          </div>
        ) : (
          <>
            {captions.map((c) => (
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
            ))}

            {/* Interim Results for Speaker (grey text) */}
            {interimCaption && (
              <div
                data-testid="interim-caption"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  backgroundColor: "var(--ground)",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px dashed var(--rule)",
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
                  <strong style={{ color: "var(--ink-soft)", fontWeight: 600 }}>
                    {speakerName}
                  </strong>
                  <span style={{ fontStyle: "italic", fontSize: "10px" }}>transcribing...</span>
                </div>
                <p
                  style={{
                    margin: "4px 0 0 0",
                    fontSize: "14px",
                    lineHeight: 1.5,
                    fontFamily: "var(--font-serif)",
                    color: "var(--ink-soft)",
                  }}
                >
                  {interimCaption}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
