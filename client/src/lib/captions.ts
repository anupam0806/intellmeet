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

export interface CaptionControllerOptions {
  onSegment: (segment: { text: string; ts: number }) => void;
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

  constructor(private options: CaptionControllerOptions) {}

  public isSupported(): boolean {
    return isSpeechRecognitionSupported();
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
      recognition.interimResults = false;
      recognition.lang =
        typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        if (!this.shouldRun()) return;
        const results = event.results;
        for (let i = event.resultIndex; i < results.length; i++) {
          const res = results[i];
          if (res && res.isFinal && res[0]) {
            const text = res[0].transcript?.trim();
            if (text) {
              this.options.onSegment({
                text,
                ts: Date.now(),
              });
            }
          }
        }
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

