import { env } from "../../config/env.js";
import type { AiProvider, GenerateOptions } from "./provider.js";

interface OpenAiCompatibleOptions {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  retryDelayMs?: number;
}

export class OpenAiCompatibleProvider implements AiProvider {
  readonly name = "openai";
  readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly retryDelayMs: number;

  constructor(options: OpenAiCompatibleOptions = {}) {
    this.baseUrl = (options.baseUrl ?? env.AI_BASE_URL).replace(/\/+$/, "");
    this.apiKey = options.apiKey ?? env.AI_API_KEY;
    this.model = options.model ?? env.AI_MODEL;
    this.timeoutMs = options.timeoutMs ?? 45000;
    this.retryDelayMs = options.retryDelayMs ?? 2000;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async executeCall(options: GenerateOptions): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: options.system },
            { role: "user", content: options.user },
          ],
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      if (response.status === 429 || response.status >= 500) {
        const error = new Error(`Retryable provider error (HTTP ${response.status})`);
        (error as { isRetryable?: boolean }).isRetryable = true;
        throw error;
      }

      if (!response.ok) {
        throw new Error(`Provider request failed with status ${response.status}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new Error("Invalid provider response structure");
      }

      return content;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        const timeoutError = new Error("AI provider request timed out");
        (timeoutError as { isRetryable?: boolean }).isRetryable = true;
        throw timeoutError;
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async generate(options: GenerateOptions): Promise<string> {
    try {
      return await this.executeCall(options);
    } catch (firstErr: unknown) {
      const isRetryable =
        typeof firstErr === "object" &&
        firstErr !== null &&
        Boolean((firstErr as { isRetryable?: boolean }).isRetryable);

      if (!isRetryable) {
        throw new Error("AI generation failed");
      }

      // Retry once after retryDelayMs
      await this.sleep(this.retryDelayMs);

      try {
        return await this.executeCall(options);
      } catch {
        throw new Error("AI generation failed after retry");
      }
    }
  }
}
