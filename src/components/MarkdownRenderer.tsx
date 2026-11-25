import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import hljs from 'highlight.js';
import { Check, Copy } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Converts highlight.js span-annotated output into pure React elements
 * without using raw HTML injection.
 */
function renderHljsToReact(html: string): React.ReactNode[] {
  const tokenRegex = /(<span class="([^"]*)">|<\/span>)/g;
  const stack: Array<{ className?: string; children: React.ReactNode[] }> = [
    { children: [] },
  ];

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;

  while ((match = tokenRegex.exec(html)) !== null) {
    if (match.index > lastIndex) {
      const textChunk = decodeHtmlEntities(html.slice(lastIndex, match.index));
      stack[stack.length - 1].children.push(textChunk);
    }

    const token = match[0];
    if (token === '</span>') {
      if (stack.length > 1) {
        const popped = stack.pop()!;
        stack[stack.length - 1].children.push(
          <span key={`tok-${keyCounter++}`} className={popped.className}>
            {popped.children}
          </span>,
        );
      }
    } else {
      const cls = match[2] || '';
      const safeClass = cls
        .split(/\s+/)
        .filter((c) => /^hljs(-[a-z0-9_]+)?$/.test(c))
        .join(' ');
      stack.push({ className: safeClass || undefined, children: [] });
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < html.length) {
    stack[stack.length - 1].children.push(decodeHtmlEntities(html.slice(lastIndex)));
  }

  while (stack.length > 1) {
    const popped = stack.pop()!;
    stack[stack.length - 1].children.push(
      <span key={`tok-${keyCounter++}`} className={popped.className}>
        {popped.children}
      </span>,
    );
  }

  return stack[0].children;
}

function isSafeHref(href?: string): boolean {
  if (!href) return false;
  const trimmed = href.trim().toLowerCase();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('mailto:')) {
    return true;
  }
  if (trimmed.startsWith('#') || trimmed.startsWith('/')) {
    return true;
  }
  return false;
}

interface CodeBlockProps {
  language?: string;
  code: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const { nodes, detectedLang } = useMemo(() => {
    try {
      if (language && hljs.getLanguage(language)) {
        const result = hljs.highlight(code, { language, ignoreIllegals: true });
        return { nodes: renderHljsToReact(result.value), detectedLang: language };
      }
      const auto = hljs.highlightAuto(code);
      return {
        nodes: renderHljsToReact(auto.value),
        detectedLang: language || auto.language || 'code',
      };
    } catch {
      return { nodes: [code], detectedLang: language || 'text' };
    }
  }, [code, language]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard may be restricted in some environments
    }
  };

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/90">
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-100/80 px-3.5 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <span className="font-mono text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {detectedLang}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex min-h-[32px] items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-200/80 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:focus-visible:outline-zinc-100"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-emerald-700 dark:text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed">
        <code className="hljs font-mono">{nodes}</code>
      </pre>
    </div>
  );
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="prose-buggy text-[15px] leading-[1.7] text-zinc-800 dark:text-zinc-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-6 mb-3 font-display text-2xl font-semibold tracking-tight text-zinc-950 first:mt-0 dark:text-zinc-50">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-5 mb-2.5 font-display text-xl font-semibold tracking-tight text-zinc-950 first:mt-0 dark:text-zinc-50">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-4 mb-2 font-display text-lg font-semibold text-zinc-950 first:mt-0 dark:text-zinc-50">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-3.5 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="mb-3.5 list-disc space-y-1.5 pl-5 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3.5 list-decimal space-y-1.5 pl-5 last:mb-0">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-[1.65]">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-4 rounded-xl border border-zinc-200 bg-zinc-50/70 px-4 py-3 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-5 border-zinc-200 dark:border-zinc-800" />,
          a: ({ href, children }) => {
            if (!isSafeHref(href)) {
              return <span className="underline">{children}</span>;
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-600 underline decoration-blue-600/30 underline-offset-2 transition-colors hover:text-blue-700 hover:decoration-blue-700 dark:text-blue-400 dark:decoration-blue-400/30 dark:hover:text-blue-300"
              >
                {children}
              </a>
            );
          },
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full border-collapse text-left text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/70">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3.5 py-2.5 font-semibold text-zinc-900 dark:text-zinc-100">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-t border-zinc-100 px-3.5 py-2.5 text-zinc-700 dark:border-zinc-800/70 dark:text-zinc-300">
              {children}
            </td>
          ),
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children, ...props }) => {
            const match = /language-([a-zA-Z0-9_+-]+)/.exec(className || '');
            const rawText = String(children ?? '').replace(/\n$/, '');
            const isBlock = Boolean(match) || rawText.includes('\n');

            if (isBlock) {
              return <CodeBlock language={match?.[1]} code={rawText} />;
            }

            return (
              <code
                className="rounded-md border border-zinc-200/80 bg-zinc-100 px-1.5 py-0.5 font-mono text-[13px] text-zinc-900 dark:border-zinc-700/80 dark:bg-zinc-800 dark:text-zinc-100"
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
