import type { Conversation, ModelId, ThemeMode } from '../types/chat';

const CONVERSATIONS_KEY = 'buggy_ai_conversations_v1';
const THEME_KEY = 'buggy_ai_theme_v1';
const MODEL_KEY = 'buggy_ai_model_v1';

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // Ignore storage errors
  }
  return 'light';
}

export function saveTheme(theme: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore storage errors
  }
}

export function applyThemeToDocument(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function loadSelectedModel(): ModelId {
  try {
    const saved = localStorage.getItem(MODEL_KEY);
    if (saved === 'gemini-4-hydrogen' || saved === 'gemini-3.1-flash-lite') {
      return saved;
    }
  } catch {
    // Ignore storage errors
  }
  return 'gemini-4-hydrogen';
}

export function saveSelectedModel(model: ModelId): void {
  try {
    localStorage.setItem(MODEL_KEY, model);
  } catch {
    // Ignore storage errors
  }
}

export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c) => c && typeof c.id === 'string' && Array.isArray(c.messages))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch {
    return [];
  }
}

export function saveConversations(conversations: Conversation[]): void {
  try {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
  } catch {
    // If localStorage quota is exceeded due to large base64 attachments,
    // strip binary base64/previewUrl payloads and keep text/metadata so history persists cleanly.
    try {
      const compact = conversations.map((conv) => ({
        ...conv,
        messages: conv.messages.map((msg) => ({
          ...msg,
          attachments: msg.attachments?.map((att) => ({
            id: att.id,
            name: att.name,
            mimeType: att.mimeType,
            size: att.size,
            kind: att.kind,
          })),
        })),
      }));
      localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(compact));
    } catch {
      // Ignore if storage is completely unavailable
    }
  }
}

export interface GroupedConversations {
  label: string;
  items: Conversation[];
}

export function groupConversationsByDate(conversations: Conversation[]): GroupedConversations[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const startOfLast7Days = startOfToday - 7 * 86_400_000;

  const today: Conversation[] = [];
  const yesterday: Conversation[] = [];
  const last7Days: Conversation[] = [];
  const older: Conversation[] = [];

  for (const conv of conversations) {
    const ts = conv.updatedAt || conv.createdAt || 0;
    if (ts >= startOfToday) {
      today.push(conv);
    } else if (ts >= startOfYesterday) {
      yesterday.push(conv);
    } else if (ts >= startOfLast7Days) {
      last7Days.push(conv);
    } else {
      older.push(conv);
    }
  }

  const groups: GroupedConversations[] = [];
  if (today.length) groups.push({ label: 'Today', items: today });
  if (yesterday.length) groups.push({ label: 'Yesterday', items: yesterday });
  if (last7Days.length) groups.push({ label: 'Previous 7 Days', items: last7Days });
  if (older.length) groups.push({ label: 'Older', items: older });

  return groups;
}

export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' Code block omitted. ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>-]{1,3}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
