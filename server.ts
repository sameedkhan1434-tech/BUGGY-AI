import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import type { Content, Part } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const ALLOWED_MODELS = [
  {
    id: 'gemini-4-hydrogen',
    label: 'Buggy Standard',
    description: 'Gemini 4 Hydrogen — balanced reasoning, coding, vision & PDFs',
    freeTierNote: 'Free tier supported with rate limits',
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Buggy Lite',
    description: 'Gemini 3.1 Flash Lite — ultra-fast responses & higher free quota',
    freeTierNote: 'Free tier supported with higher throughput',
  },
] as const;

const ALLOWED_MODEL_IDS = new Set<string>(ALLOWED_MODELS.map((m) => m.id));

const ALLOWED_BINARY_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

const MAX_ATTACHMENTS_PER_MSG = 5;
const MAX_BASE64_BYTES = 15 * 1024 * 1024; // ~11MB raw file in base64
const MAX_TEXT_CHARS = 250_000;

interface IncomingAttachment {
  name: string;
  mimeType: string;
  kind: 'image' | 'pdf' | 'text';
  base64?: string;
  textContent?: string;
}

interface IncomingMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: IncomingAttachment[];
}

const SYSTEM_INSTRUCTION = `You are BUGGY AI, a calm, thoughtful, and highly capable AI assistant.
- Be accurate, clear, and genuinely helpful without filler or sycophancy.
- Use clean Markdown formatting when appropriate: headings, concise lists, tables, and fenced code blocks with explicit language identifiers (e.g. \`\`\`typescript, \`\`\`python).
- When the user attaches images, PDFs, or text/code files, analyze their actual contents carefully and cite specific details you observe.
- If you are unsure or a request lacks context, say so honestly and ask a focused clarifying question.`;

function getConfiguredApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return key;
}

function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function classifyGeminiError(err: unknown): {
  status: number;
  code: string;
  message: string;
} {
  const rawMessage = err instanceof Error ? err.message : String(err);
  let extractedMessage = rawMessage;
  let extractedStatus: number | undefined =
    typeof (err as { status?: unknown })?.status === 'number'
      ? ((err as { status: number }).status)
      : undefined;

  // Unwrap up to 2 levels of nested JSON error strings from SDK ApiError
  for (let depth = 0; depth < 2; depth++) {
    const jsonStart = extractedMessage.indexOf('{');
    if (jsonStart < 0) break;
    try {
      const parsed = JSON.parse(extractedMessage.slice(jsonStart)) as {
        error?: { code?: number; message?: string; status?: string };
      };
      if (typeof parsed?.error?.code === 'number') {
        extractedStatus = parsed.error.code;
      }
      if (parsed?.error?.message) {
        extractedMessage = parsed.error.message;
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  const lower = `${rawMessage} ${extractedMessage}`.toLowerCase();

  if (
    extractedStatus === 429 ||
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit') ||
    lower.includes('quota')
  ) {
    return {
      status: 429,
      code: 'RATE_LIMITED',
      message:
        'Free-tier rate limit reached. Please wait a few seconds and try again, or switch to Buggy Lite for higher free quota.',
    };
  }

  if (
    extractedStatus === 503 ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded')
  ) {
    return {
      status: 503,
      code: 'MODEL_BUSY',
      message:
        'The AI model is currently experiencing high demand. Please retry in a few seconds, or switch to Buggy Lite.',
    };
  }

  if (
    extractedStatus === 401 ||
    extractedStatus === 403 ||
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied') ||
    lower.includes('api key not valid')
  ) {
    return {
      status: 403,
      code: 'API_KEY_INVALID',
      message:
        'The server API key was rejected or is invalid. Verify GEMINI_API_KEY in Settings > Secrets or your host environment variables.',
    };
  }

  if (extractedStatus === 404 || lower.includes('not_found')) {
    return {
      status: 404,
      code: 'MODEL_NOT_FOUND',
      message:
        'The selected model is currently unavailable. Please switch models or try again shortly.',
    };
  }

  if (extractedStatus === 400 || lower.includes('invalid_argument')) {
    return {
      status: 400,
      code: 'INVALID_REQUEST',
      message: `The AI provider could not process this request: ${extractedMessage}`,
    };
  }

  return {
    status: 500,
    code: 'AI_UPSTREAM_ERROR',
    message:
      extractedMessage.length > 0 && extractedMessage.length < 300
        ? `AI request failed: ${extractedMessage}`
        : 'Unable to complete the AI request right now. Please try again in a moment.',
  };
}

function buildGeminiContents(messages: IncomingMessage[]): Content[] {
  const contents: Content[] = [];

  for (const msg of messages) {
    const parts: Part[] = [];

    if (Array.isArray(msg.attachments)) {
      for (const att of msg.attachments.slice(0, MAX_ATTACHMENTS_PER_MSG)) {
        if ((att.kind === 'image' || att.kind === 'pdf') && att.base64) {
          if (!ALLOWED_BINARY_MIMES.has(att.mimeType)) {
            throw new Error(`Unsupported file type: ${att.mimeType}`);
          }
          if (att.base64.length > MAX_BASE64_BYTES) {
            throw new Error(`Attachment "${att.name}" exceeds the 10 MB upload limit.`);
          }
          parts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.base64,
            },
          });
        } else if (att.kind === 'text' && typeof att.textContent === 'string') {
          const safeText = att.textContent.slice(0, MAX_TEXT_CHARS);
          parts.push({
            text: `[Attached file: ${att.name} (${att.mimeType})]\n\`\`\`\n${safeText}\n\`\`\``,
          });
        }
      }
    }

    const trimmedText = typeof msg.content === 'string' ? msg.content.trim() : '';
    if (trimmedText) {
      parts.push({ text: trimmedText });
    } else if (parts.length > 0 && msg.role === 'user') {
      parts.push({ text: 'Please analyze the attached file(s).' });
    }

    if (parts.length > 0) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts,
      });
    }
  }

  return contents;
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '25mb' }));

const ALLOWED_ORIGINS = new Set(
  [
    'https://sameedkhan1434-tech.github.io',
    process.env.ALLOWED_ORIGIN?.trim(),
  ].filter((v): v is string => Boolean(v)),
);

app.use('/api', (req: Request, res: Response, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// Health & capabilities endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  const apiKey = getConfiguredApiKey();
  res.json({
    ok: true,
    aiConfigured: Boolean(apiKey),
    provider: 'Google Gemini API (Free Tier)',
    defaultModel: 'gemini-4-hydrogen',
    models: ALLOWED_MODELS,
    freeTierLimits:
      'Runs on Gemini free tier without billing or credit cards. Requests are subject to per-minute and daily rate limits.',
  });
});

// Streaming chat endpoint using Server-Sent Events (SSE)
app.post('/api/chat', async (req: Request, res: Response) => {
  const apiKey = getConfiguredApiKey();
  if (!apiKey) {
    res.status(503).json({
      error:
        'GEMINI_API_KEY is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets (or your hosting environment variables) to enable live AI responses.',
      code: 'API_KEY_MISSING',
    });
    return;
  }

  const body = req.body as {
    messages?: unknown;
    model?: unknown;
  };

  if (!Array.isArray(body?.messages) || body.messages.length === 0) {
    res.status(400).json({
      error: 'Request must include a non-empty messages array.',
      code: 'INVALID_REQUEST',
    });
    return;
  }

  const requestedModel =
    typeof body.model === 'string' && ALLOWED_MODEL_IDS.has(body.model)
      ? body.model
      : 'gemini-4-hydrogen';

  const validatedMessages: IncomingMessage[] = [];
  for (const item of body.messages) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    const role = raw.role === 'assistant' ? 'assistant' : raw.role === 'user' ? 'user' : null;
    if (!role) continue;
    const content = typeof raw.content === 'string' ? raw.content : '';
    const attachments = Array.isArray(raw.attachments)
      ? (raw.attachments as IncomingAttachment[])
      : undefined;
    validatedMessages.push({ role, content, attachments });
  }

  let contents: Content[];
  try {
    contents = buildGeminiContents(validatedMessages);
  } catch (validationErr) {
    res.status(400).json({
      error: validationErr instanceof Error ? validationErr.message : 'Invalid attachment.',
      code: 'INVALID_ATTACHMENT',
    });
    return;
  }

  if (contents.length === 0) {
    res.status(400).json({
      error: 'Please enter a message or attach a file before sending.',
      code: 'EMPTY_MESSAGE',
    });
    return;
  }

  // Open SSE stream
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let clientClosed = false;
  res.on('close', () => {
    if (!res.writableEnded) {
      clientClosed = true;
    }
  });

  const sendEvent = (payload: Record<string, unknown>) => {
    if (!clientClosed && !res.writableEnded) {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  };

  try {
    const ai = createGeminiClient(apiKey);
    let hasSentDelta = false;
    let lastErr: unknown = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      if (clientClosed) break;
      try {
        const stream = await ai.models.generateContentStream({
          model: requestedModel,
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
          },
        });

        for await (const chunk of stream) {
          if (clientClosed) {
            break;
          }
          const text = chunk.text;
          if (text) {
            hasSentDelta = true;
            sendEvent({ type: 'delta', text });
          }
        }
        lastErr = null;
        break;
      } catch (attemptErr) {
        lastErr = attemptErr;
        const info = classifyGeminiError(attemptErr);
        if (attempt === 0 && !hasSentDelta && !clientClosed && info.code === 'MODEL_BUSY') {
          await new Promise((r) => setTimeout(r, 700));
          continue;
        }
        throw attemptErr;
      }
    }

    if (lastErr) {
      throw lastErr;
    }

    if (!clientClosed) {
      sendEvent({ type: 'done' });
    }
  } catch (err) {
    console.error('[/api/chat] Gemini stream error:', err);
    const classified = classifyGeminiError(err);
    sendEvent({
      type: 'error',
      code: classified.code,
      message: classified.message,
    });
  } finally {
    if (!res.writableEnded) {
      res.end();
    }
  }
});

// Optional conversation title generator (falls back gracefully)
app.post('/api/title', async (req: Request, res: Response) => {
  const apiKey = getConfiguredApiKey();
  const body = req.body as { prompt?: unknown };
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim().slice(0, 500) : '';

  if (!prompt) {
    res.status(400).json({ error: 'Prompt is required.' });
    return;
  }

  const fallbackTitle =
    prompt.length > 44 ? `${prompt.slice(0, 41).trimEnd()}...` : prompt;

  if (!apiKey) {
    res.json({ title: fallbackTitle });
    return;
  }

  try {
    const ai = createGeminiClient(apiKey);
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: `Create a concise 3 to 5 word title (no quotes, no trailing punctuation) summarizing this user request:\n\n${prompt}`,
    });
    const generated = response.text?.replace(/^["'`]+|["'`]+$/g, '').trim();
    res.json({
      title: generated && generated.length <= 60 ? generated : fallbackTitle,
    });
  } catch {
    res.json({ title: fallbackTitle });
  }
});

// Explicit 404 handler for unknown /api/* endpoints
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found', code: 'NOT_FOUND' });
});

async function startServer() {
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use('/BUGGY-AI', express.static(distPath));
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.warn('dist/ directory not found. Run "npm run build" before starting in production.');
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    const configured = Boolean(getConfiguredApiKey());
    console.log(
      `BUGGY AI server running on http://0.0.0.0:${PORT} (mode: ${IS_PROD ? 'production' : 'development'}, Gemini API configured: ${configured})`,
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start BUGGY AI server:', err);
  process.exit(1);
});
