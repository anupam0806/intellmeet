export interface TimelineItem {
  timestamp: Date;
  speaker: string;
  text: string;
  isChat: boolean;
}

export function buildSystemPrompt(): string {
  return `You are an AI meeting assistant that writes structured write-ups of team meetings.

You must follow these strict rules:
1. Use ONLY the supplied transcript and chat content. Never invent people, decisions, dates, commitments, or tasks.
2. The transcript comes from automatic speech recognition and may contain misheard words, especially short words and acronyms. Never invent corrections: keep a doubtful word as written, and only use a different term when the meeting title or other lines make it unambiguous. Do not mention the speech recognition in the summary.
3. Write at most 200 words of summary.
4. Output must be raw valid JSON ONLY, with NO surrounding explanation or conversational text.

The JSON schema must strictly match:
{
  "summary": "Concise summary up to 200 words",
  "keyPoints": ["Key point 1", "Key point 2"],
  "decisions": ["Agreed decision 1"],
  "actionItems": [
    {
      "title": "Action item description (2 to 200 characters)",
      "assigneeName": "Full name or first name of the person responsible, or null",
      "dueDate": "YYYY-MM-DD only if an explicit date is stated in the text, otherwise null"
    }
  ]
}`;
}

export function formatTimestamp(date: Date): string {
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `[${hours}:${minutes}]`;
}

export function buildUserPrompt(
  meetingTitle: string,
  items: TimelineItem[],
  maxChars = 30000,
): string {
  const header = `Meeting Title: ${meetingTitle}\n\nTranscript & Chat:\n`;

  // Format all lines in chronological order
  const formattedLines: string[] = items.map((item) => {
    const time = formatTimestamp(item.timestamp);
    const tag = item.isChat ? " (chat)" : "";
    return `${time}${tag} ${item.speaker}: ${item.text}`;
  });

  // If already fits
  const body = formattedLines.join("\n");
  if ((header + body).length <= maxChars) {
    return header + body;
  }

  // Truncate oldest lines when over maxChars
  const lines = [...formattedLines];
  while (lines.length > 0 && (header + lines.join("\n")).length > maxChars) {
    lines.shift();
  }

  return header + lines.join("\n");
}
