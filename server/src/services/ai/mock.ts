import type { AiProvider, GenerateOptions } from "./provider.js";

export class MockAiProvider implements AiProvider {
  readonly name = "mock";
  readonly model = "deterministic-mock-v1";

  async generate(options: GenerateOptions): Promise<string> {
    const lines = options.user
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && l.startsWith("["));

    // Extract speakers and content from lines like "[HH:MM] Speaker: content" or "[HH:MM] (chat) Speaker: content"
    const speakers = new Set<string>();
    const segmentTexts: string[] = [];
    interface MockActionItem {
      title: string;
      assigneeName: string | null;
      dueDate: string | null;
    }
    const actionItems: MockActionItem[] = [];

    const lineRegex = /^\[\d{2}:\d{2}\](?:\s*\(chat\))?\s*([^:]+):\s*(.+)$/i;

    for (const line of lines) {
      const match = lineRegex.exec(line);
      if (match) {
        const speaker = match[1]?.trim() ?? "Unknown";
        const text = match[2]?.trim() ?? "";
        speakers.add(speaker);
        segmentTexts.push(text);

        // Action items from lines containing "will " or "I'll" with the speaker as assigneeName
        if (/\bwill\s+/i.test(text) || /\bi'll\b/i.test(text)) {
          let title = text;
          if (title.length > 180) {
            title = title.slice(0, 180) + "...";
          }
          if (title.length < 2) {
            title = "Follow up on action item";
          }
          actionItems.push({
            title,
            assigneeName: speaker,
            dueDate: null,
          });
        }
      }
    }

    const speakerList = Array.from(speakers);
    const speakerSummary = speakerList.length > 0 ? speakerList.join(", ") : "None";
    const segmentCount = lines.length;

    const summary = `Meeting included ${segmentCount} segments across speakers: ${speakerSummary}.`;

    // Key points from the first three segments
    const keyPoints = segmentTexts.slice(0, 3).map((text) => {
      return text.length > 200 ? text.slice(0, 197) + "..." : text;
    });

    const decisions: string[] = [];

    const result = {
      summary,
      keyPoints,
      decisions,
      actionItems,
    };

    return JSON.stringify(result, null, 2);
  }
}
