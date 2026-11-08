export function getSpeechRecognitionConstructor(): unknown {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition ||
    null
  );
}

export function isSpeechRecognitionSupported(): boolean {
  return Boolean(getSpeechRecognitionConstructor());
}

export interface CaptionLanguageOption {
  code: string;
  label: string;
}

export const CAPTION_LANGUAGES: CaptionLanguageOption[] = [
  { code: "en-IN", label: "English (India)" },
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "hi-IN", label: "Hindi" },
];

export const CAPTION_LANGUAGE_STORAGE_KEY = "intellmeet_caption_language";

export function getDefaultCaptionLanguage(): string {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const saved = window.localStorage.getItem(CAPTION_LANGUAGE_STORAGE_KEY);
      if (saved && CAPTION_LANGUAGES.some((l) => l.code === saved)) {
        return saved;
      }
    } catch {
      // Ignore localStorage access error
    }
  }

  if (typeof navigator !== "undefined" && navigator.language) {
    const navLang = navigator.language.toLowerCase();
    const match = CAPTION_LANGUAGES.find(
      (l) => l.code.toLowerCase() === navLang || navLang.startsWith(l.code.toLowerCase()),
    );
    if (match) return match.code;
    if (navLang.startsWith("hi")) return "hi-IN";
    if (navLang.startsWith("en")) {
      if (navLang.includes("in")) return "en-IN";
      if (navLang.includes("gb")) return "en-GB";
      return "en-US";
    }
  }

  return "en-US";
}

export function saveCaptionLanguage(lang: string): void {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(CAPTION_LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // Ignore localStorage access error
    }
  }
}

export interface CaptionControllerOptions {
  initialLanguage?: string;
  onSegment: (segment: { text: string; ts: number }) => void;
  onInterim?: (text: string) => void;
  onError: (message: string) => void;
  onCaptionsOff: () => void;
}

export class CaptionController {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private recognition: any = null;
  private isCaptionsEnabled = false;
  private isMuted = false;
  private isInRoom = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private restartTimeout: any = null;
  private isExplicitlyStopped = true;
  private language: string;

  constructor(private options: CaptionControllerOptions) {
    this.language = options.initialLanguage || getDefaultCaptionLanguage();
  }

  public isSupported(): boolean {
    return isSpeechRecognitionSupported();
  }

  public getLanguage(): string {
    return this.language;
  }

  public setLanguage(lang: string) {
    if (this.language === lang) return;
    this.language = lang;
    saveCaptionLanguage(lang);
    if (this.recognition) {
      this.stopRecognition();
      if (this.shouldRun()) {
        this.startRecognition();
      }
    }
  }

  public setCaptionsEnabled(enabled: boolean) {
    this.isCaptionsEnabled = enabled;
    if (enabled) {
      this.isExplicitlyStopped = false;
      this.checkAndApplyState();
    } else {
      this.isExplicitlyStopped = true;
      this.stopRecognition();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    this.checkAndApplyState();
  }

  public setInRoom(inRoom: boolean) {
    this.isInRoom = inRoom;
    if (!inRoom) {
      this.destroy();
    } else {
      this.checkAndApplyState();
    }
  }

  private shouldRun(): boolean {
    return this.isCaptionsEnabled && !this.isMuted && this.isInRoom && !this.isExplicitlyStopped;
  }

  private checkAndApplyState() {
    if (this.shouldRun()) {
      this.startRecognition();
    } else {
      this.stopRecognition();
    }
  }

  private startRecognition() {
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    if (this.recognition) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = getSpeechRecognitionConstructor() as any;
    if (!SpeechRec) {
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = this.language;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        if (!this.shouldRun()) return;
        const results = event.results;
        let interimText = "";
        for (let i = event.resultIndex; i < results.length; i++) {
          const res = results[i];
          if (res && res[0]) {
            if (res.isFinal) {
              const text = res[0].transcript?.trim();
              if (text) {
                this.options.onSegment({
                  text,
                  ts: Date.now(),
                });
              }
            } else {
              interimText += res[0].transcript;
            }
          }
        }
        this.options.onInterim?.(interimText.trim());
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        const error = event.error;
        if (error === "no-speech" || error === "aborted") {
          return;
        }

        if (error === "not-allowed" || error === "service-not-allowed") {
          this.setCaptionsEnabled(false);
          this.options.onCaptionsOff();
          this.options.onError("Microphone access for live captions was denied or not allowed.");
          return;
        }
      };

      recognition.onend = () => {
        this.recognition = null;
        this.options.onInterim?.("");
        if (this.shouldRun()) {
          // Restart automatically about 300 ms after onend while captions are on
          this.restartTimeout = setTimeout(() => {
            if (this.shouldRun()) {
              this.startRecognition();
            }
          }, 300);
        }
      };

      this.recognition = recognition;
      recognition.start();
    } catch {
      this.recognition = null;
    }
  }

  private stopRecognition() {
    this.options.onInterim?.("");
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore stop error
      }
      this.recognition = null;
    }
  }

  public destroy() {
    this.isCaptionsEnabled = false;
    this.isInRoom = false;
    this.isExplicitlyStopped = true;
    this.stopRecognition();
  }
}
