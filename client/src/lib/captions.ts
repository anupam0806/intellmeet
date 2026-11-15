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
  initialMuted?: boolean;
  initialCaptionsEnabled?: boolean;
  onSegment: (segment: { text: string; ts: number }) => void;
  onInterim?: (text: string) => void;
  onError: (message: string) => void;
  onCaptionsOff: () => void;
  onListeningChange?: (isListening: boolean) => void;
}

export class CaptionController {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private recognition: any = null;
  private isCaptionsEnabled = false;
  private isMuted = false;
  private isInRoom = true;
  private isStarting = false;
  private isRunning = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private restartTimeout: any = null;
  private language: string;

  constructor(private options: CaptionControllerOptions) {
    this.language = options.initialLanguage || getDefaultCaptionLanguage();
    if (typeof options.initialMuted === "boolean") {
      this.isMuted = options.initialMuted;
    }
    if (typeof options.initialCaptionsEnabled === "boolean") {
      this.isCaptionsEnabled = options.initialCaptionsEnabled;
      if (options.initialCaptionsEnabled) {
        this.checkAndApplyState();
      }
    }
  }

  public isSupported(): boolean {
    return isSpeechRecognitionSupported();
  }

  public getLanguage(): string {
    return this.language;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public getCaptionsEnabled(): boolean {
    return this.isCaptionsEnabled;
  }

  public getListening(): boolean {
    return this.isRunning;
  }

  public setLanguage(lang: string) {
    if (this.language === lang) return;
    this.language = lang;
    saveCaptionLanguage(lang);
    if (this.recognition || this.isRunning || this.isStarting) {
      this.stopRecognition();
      if (this.shouldRun()) {
        this.startRecognition();
      }
    }
  }

  public setCaptionsEnabled(enabled: boolean) {
    if (this.isCaptionsEnabled === enabled) return;
    this.isCaptionsEnabled = enabled;
    this.checkAndApplyState();
  }

  public setMuted(muted: boolean) {
    if (this.isMuted === muted) return;
    this.isMuted = muted;
    this.checkAndApplyState();
  }

  public setInRoom(inRoom: boolean) {
    if (this.isInRoom === inRoom) return;
    this.isInRoom = inRoom;
    if (!inRoom) {
      this.destroy();
    } else {
      this.checkAndApplyState();
    }
  }

  public shouldRun(): boolean {
    const run = this.isCaptionsEnabled && !this.isMuted && this.isInRoom;
    console.log(`[Captions] shouldRun() => ${run} (captionsEnabled: ${this.isCaptionsEnabled}, muted: ${this.isMuted}, inRoom: ${this.isInRoom})`);
    return run;
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

    if (!this.shouldRun()) {
      return;
    }

    if (this.isRunning || this.isStarting || this.recognition) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = getSpeechRecognitionConstructor() as any;
    if (!SpeechRec) {
      return;
    }

    try {
      this.isStarting = true;
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = this.language;

      recognition.onstart = () => {
        if (this.recognition !== recognition) return;
        this.isStarting = false;
        this.isRunning = true;
        console.log(`[Captions] recognition.onstart: recognition session active`);
        this.options.onListeningChange?.(true);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        if (!this.shouldRun()) {
          this.options.onInterim?.("");
          return;
        }
        const results = event.results;
        let interimText = "";
        for (let i = 0; i < results.length; i++) {
          const res = results[i];
          if (res && res[0]) {
            if (res.isFinal) {
              if (i >= event.resultIndex) {
                const text = res[0].transcript?.trim();
                if (text && this.shouldRun()) {
                  console.log(`[Captions] recognition.onresult [final]: "${text}"`);
                  this.options.onSegment({
                    text,
                    ts: Date.now(),
                  });
                }
              }
            } else {
              interimText += res[0].transcript;
            }
          }
        }
        if (interimText) {
          console.log(`[Captions] recognition.onresult [interim]: "${interimText.trim()}"`);
        }
        if (this.shouldRun()) {
          this.options.onInterim?.(interimText.trim());
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        const error = event.error;
        console.log(`[Captions] recognition.onerror: error=${error}`);

        if (error === "no-speech" || error === "aborted") {
          return;
        }

        if (error === "not-allowed" || error === "service-not-allowed") {
          this.setCaptionsEnabled(false);
          this.options.onCaptionsOff();
          this.options.onError(
            error === "not-allowed"
              ? "Microphone access for live captions was denied. Please allow microphone access in your browser."
              : "Live captions service is not allowed by browser or system settings."
          );
          return;
        }

        if (error === "network") {
          this.options.onError("Live captions network connection error. Reconnecting...");
          return;
        }

        if (error === "audio-capture") {
          this.setCaptionsEnabled(false);
          this.options.onCaptionsOff();
          this.options.onError("Microphone capture failed. Please check your audio input device.");
          return;
        }

        this.options.onError(`Live captions error: ${error}`);
      };

      recognition.onend = () => {
        if (this.recognition !== recognition) {
          return;
        }
        this.isStarting = false;
        this.isRunning = false;
        this.recognition = null;
        console.log(`[Captions] recognition.onend: recognition session ended`);
        this.options.onListeningChange?.(false);
        this.options.onInterim?.("");

        if (this.shouldRun()) {
          this.restartTimeout = setTimeout(() => {
            if (this.shouldRun()) {
              this.startRecognition();
            }
          }, 300);
        }
      };

      this.recognition = recognition;
      console.log(`[Captions] recognition.start() called with language: ${this.language}`);
      recognition.start();
    } catch (err: unknown) {
      console.warn(`[Captions] recognition.start() error:`, err);
      this.isStarting = false;
      this.isRunning = false;
      this.recognition = null;
      if (this.shouldRun()) {
        this.restartTimeout = setTimeout(() => {
          if (this.shouldRun()) {
            this.startRecognition();
          }
        }, 300);
      }
    }
  }

  private stopRecognition() {
    console.log(`[Captions] stopRecognition() called`);
    this.options.onInterim?.("");
    this.options.onListeningChange?.(false);

    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    this.isStarting = false;
    this.isRunning = false;

    if (this.recognition) {
      const rec = this.recognition;
      this.recognition = null;
      try {
        if (typeof rec.stop === "function") {
          rec.stop();
        } else if (typeof rec.abort === "function") {
          rec.abort();
        }
      } catch {
        try {
          if (typeof rec.abort === "function") {
            rec.abort();
          }
        } catch {
          // Ignore
        }
      }
    }
  }

  public destroy() {
    this.isCaptionsEnabled = false;
    this.isInRoom = false;
    this.stopRecognition();
  }
}
