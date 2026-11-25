export type ThemeMode = 'light' | 'dark';

export type ModelId = 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';

export interface ModelOption {
  id: ModelId;
  label: string;
  description: string;
  freeTierNote: string;
}

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: 'image' | 'pdf' | 'text';
  /** Base64 string without data URL prefix for image/pdf */
  base64?: string;
  /** Data URL for rendering image preview in UI */
  previewUrl?: string;
  /** Extracted UTF-8 text content for text/code files */
  textContent?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
  createdAt: number;
  isError?: boolean;
  isDemo?: boolean;
  stopped?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: ModelId;
  createdAt: number;
  updatedAt: number;
}

export interface HealthStatus {
  ok: boolean;
  aiConfigured: boolean;
  provider: string;
  defaultModel: ModelId;
  models: ModelOption[];
  freeTierLimits: string;
}
