import type { Attachment } from '../types/chat';
import { createId } from './storage';

const MAX_BINARY_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_TEXT_SIZE_BYTES = 1024 * 1024; // 1 MB

const IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.json',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.py',
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.sql',
  '.xml',
  '.yaml',
  '.yml',
  '.log',
  '.sh',
  '.bash',
  '.env',
  '.ini',
  '.toml',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.go',
  '.rs',
  '.php',
  '.rb',
]);

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx).toLowerCase() : '';
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Failed to read "${file.name}".`));
    reader.readAsDataURL(file);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Failed to read "${file.name}".`));
    reader.readAsText(file);
  });
}

export async function processUploadedFile(file: File): Promise<Attachment> {
  const ext = getFileExtension(file.name);
  const mime = file.type.toLowerCase();

  // 1. Image files
  if (IMAGE_MIME_TYPES.has(mime)) {
    if (file.size > MAX_BINARY_SIZE_BYTES) {
      throw new Error(
        `Image "${file.name}" is ${formatFileSize(file.size)}. Maximum image size is 10 MB.`,
      );
    }
    const dataUrl = await readAsDataUrl(file);
    const commaIdx = dataUrl.indexOf(',');
    const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : '';
    if (!base64) {
      throw new Error(`Could not encode image "${file.name}".`);
    }
    return {
      id: createId(),
      name: file.name,
      mimeType: mime,
      size: file.size,
      kind: 'image',
      base64,
      previewUrl: dataUrl,
    };
  }

  // 2. PDF files
  if (mime === 'application/pdf' || ext === '.pdf') {
    if (file.size > MAX_BINARY_SIZE_BYTES) {
      throw new Error(
        `PDF "${file.name}" is ${formatFileSize(file.size)}. Maximum PDF size is 10 MB.`,
      );
    }
    const dataUrl = await readAsDataUrl(file);
    const commaIdx = dataUrl.indexOf(',');
    const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : '';
    if (!base64) {
      throw new Error(`Could not encode PDF "${file.name}".`);
    }
    return {
      id: createId(),
      name: file.name,
      mimeType: 'application/pdf',
      size: file.size,
      kind: 'pdf',
      base64,
    };
  }

  // 3. Text & Code files
  const isTextMime =
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/xml' ||
    mime === 'application/javascript';

  if (isTextMime || TEXT_EXTENSIONS.has(ext)) {
    if (file.size > MAX_TEXT_SIZE_BYTES) {
      throw new Error(
        `Text file "${file.name}" is ${formatFileSize(file.size)}. Maximum text file size is 1 MB.`,
      );
    }
    const textContent = await readAsText(file);
    return {
      id: createId(),
      name: file.name,
      mimeType: mime || 'text/plain',
      size: file.size,
      kind: 'text',
      textContent,
    };
  }

  throw new Error(
    `Unsupported file "${file.name}". Supported formats: PNG, JPG, WebP, GIF, PDF, TXT, MD, CSV, JSON, and code files.`,
  );
}
