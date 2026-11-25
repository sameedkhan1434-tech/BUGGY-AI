import type { Attachment, ModelId } from '../types/chat';
import { formatFileSize } from './files';

function getModelDisplayName(modelId: ModelId): string {
  return modelId === 'gemini-3.1-flash-lite'
    ? 'Buggy Lite (Gemini 3.1 Flash Lite)'
    : 'Buggy Standard (Gemini 4 Hydrogen)';
}

function isGreeting(text: string): boolean {
  const normalized = text.trim().toLowerCase().replace(/[!.,?]+$/g, '');
  return /^(hi|hello|hey|yo|hola|salam|assalam|asalam|assalamualaikum|namaste|good morning|good afternoon|good evening|how are you|kya hal|kaise ho)$/.test(
    normalized,
  );
}

function formatAttachmentSummary(attachments: Attachment[]): string {
  const lines = attachments.map((att) => {
    const base = `- **${att.name}** (${att.kind.toUpperCase()}, ${formatFileSize(att.size)})`;
    if (att.kind === 'text' && att.textContent) {
      const preview = att.textContent.trim().slice(0, 180).replace(/\s+/g, ' ');
      return `${base}\n  > Local text preview: \`${preview}${att.textContent.trim().length > 180 ? '...' : ''}\``;
    }
    return base;
  });

  return [
    `### Attached Files Detected Locally`,
    `In Demo Mode, files stay strictly in your browser and are not uploaded to any server:`,
    ...lines,
  ].join('\n');
}

export function buildLocalDemoResponse(params: {
  promptText: string;
  model: ModelId;
  attachments?: Attachment[];
  isStaticHost: boolean;
}): string {
  const { promptText, model, attachments = [], isStaticHost } = params;
  const trimmedPrompt = promptText.trim();
  const modelLabel = getModelDisplayName(model);

  const headerNotice = isStaticHost
    ? `> **GitHub Pages Demo Mode (Local Simulation):** This response was generated directly in your browser with no \`/api/chat\` or backend request.`
    : `> **Demo Mode (Local Simulation):** This response was generated locally in your browser because live server AI (\`GEMINI_API_KEY\`) is not active.`;

  const sections: string[] = [headerNotice];

  if (attachments.length > 0) {
    sections.push(formatAttachmentSummary(attachments));
  }

  if (trimmedPrompt && isGreeting(trimmedPrompt)) {
    sections.push(
      `Hello! Welcome to **BUGGY AI**.`,
      `You sent *"${trimmedPrompt}"* using **${modelLabel}**. Everything in the interface is working locally:`,
      `- **Chat & History:** Conversations save automatically in browser \`localStorage\`.`,
      `- **Attachments:** Use the **+** button to preview photos, PDFs, and code/text files locally.`,
      `- **Voice & Audio:** Try the microphone button to dictate, or click **Listen** below to hear this reply read aloud.`,
      `- **Live AI Hosting:** To connect real Gemini responses later, run \`server.ts\` on a Node.js host with \`GEMINI_API_KEY\` set.`,
    );
    return sections.join('\n\n');
  }

  const promptPreview = trimmedPrompt
    ? `*"${trimmedPrompt.slice(0, 140)}${trimmedPrompt.length > 140 ? '...' : ''}"*`
    : '*Attached file preview*';

  sections.push(
    `Received in Demo Mode (${modelLabel}): ${promptPreview}`,
    [
      `### What This Demo Mode Shows`,
      `- **Streaming & Markdown:** Simulated token streaming, lists, and syntax-highlighted code blocks work end-to-end without a backend.`,
      `- **Zero Backend Requests:** No \`POST /api/chat\` call was made, preventing static-host \`405\` errors on GitHub Pages.`,
      `- **Enable Real AI Later:** Deploy \`server.ts\` with a free-tier \`GEMINI_API_KEY\` (or set \`VITE_API_URL\` to your Node server) for live answers.`,
    ].join('\n'),
  );

  if (/\b(code|ts|typescript|js|javascript|python|react|bug|fix|function|example)\b/i.test(trimmedPrompt)) {
    sections.push(
      [
        `\`\`\`typescript`,
        `// Local Demo Mode example snippet`,
        `export function buggyDemoReply(input: string): string {`,
        `  return \`[Demo Mode] Received: \${input.trim()}\`;`,
        `}`,
        `\`\`\``,
      ].join('\n'),
    );
  }

  return sections.join('\n\n');
}
