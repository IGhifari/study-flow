'use client';

import * as React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Escapes characters to prevent raw HTML execution
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validates link URL for safety (only allows http, https, or mailto)
 */
function isSafeUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('mailto:')
  );
}

/**
 * Parses inline markdown: bold, italic, code, links, image placeholders
 */
function renderInline(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // 1. Image placeholder: ![alt](url) -> display safe placeholder without fetching external URL
    const imgMatch = /^!\[([^\]]*)\]\(([^)]*)\)/.exec(remaining);
    if (imgMatch) {
      const alt = imgMatch[1] || 'Gambar';
      elements.push(
        <span
          key={`img-${key++}`}
          className="inline-flex items-center gap-1 px-2 py-0.5 my-0.5 text-xs font-mono rounded bg-muted text-muted-foreground border border-border"
          title="Pratinjau gambar eksternal dinonaktifkan demi privasi dan keamanan"
        >
          🖼️ [Gambar: {alt}]
        </span>
      );
      remaining = remaining.slice(imgMatch[0].length);
      continue;
    }

    // 2. Link: [text](url) -> safe external link with rel="noopener noreferrer"
    const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)/.exec(remaining);
    if (linkMatch) {
      const linkText = linkMatch[1]!;
      const url = linkMatch[2]!.trim();
      if (isSafeUrl(url)) {
        elements.push(
          <a
            key={`a-${key++}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline font-medium hover:text-primary/80 transition-colors"
          >
            {linkText}
          </a>
        );
      } else {
        // Disallowed protocol (e.g. javascript:)
        elements.push(
          <span key={`unsafe-${key++}`} className="line-through text-destructive">
            {linkText}
          </span>
        );
      }
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // 3. Inline code: `code`
    const codeMatch = /^`([^`]+)`/.exec(remaining);
    if (codeMatch) {
      elements.push(
        <code
          key={`code-${key++}`}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground border border-border"
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // 4. Bold + Italic: ***text***
    const boldItalicMatch = /^\*\*\*([^*]+)\*\*\*/.exec(remaining);
    if (boldItalicMatch) {
      elements.push(
        <strong key={`bi-${key++}`} className="font-bold italic">
          {boldItalicMatch[1]}
        </strong>
      );
      remaining = remaining.slice(boldItalicMatch[0].length);
      continue;
    }

    // 5. Bold: **text**
    const boldMatch = /^\*\*([^*]+)\*\*/.exec(remaining);
    if (boldMatch) {
      elements.push(
        <strong key={`b-${key++}`} className="font-semibold text-foreground">
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // 6. Italic: *text* or _text_
    const italicMatch = /^(\*([^*]+)\*|_([^_]+)_)/.exec(remaining);
    if (italicMatch) {
      const italicText = italicMatch[2] || italicMatch[3];
      elements.push(
        <em key={`em-${key++}`} className="italic">
          {italicText}
        </em>
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // 7. Strikethrough: ~~text~~
    const strikeMatch = /^~~([^~]+)~~/.exec(remaining);
    if (strikeMatch) {
      elements.push(
        <span key={`strike-${key++}`} className="line-through text-muted-foreground">
          {strikeMatch[1]}
        </span>
      );
      remaining = remaining.slice(strikeMatch[0].length);
      continue;
    }

    // Regular character (or escaped bracket/asterisk)
    const nextSpecialIndex = remaining.search(/[!\[`*_~]/);
    if (nextSpecialIndex === -1) {
      elements.push(remaining);
      break;
    } else if (nextSpecialIndex > 0) {
      elements.push(remaining.slice(0, nextSpecialIndex));
      remaining = remaining.slice(nextSpecialIndex);
    } else {
      // First character is special but didn't match a full token
      elements.push(remaining[0]);
      remaining = remaining.slice(1);
    }
  }

  return elements;
}

export function SafeMarkdownRenderer({ content, className = '' }: MarkdownRendererProps): React.JSX.Element {
  if (!content || !content.trim()) {
    return (
      <div className={`text-muted-foreground italic text-sm ${className}`}>
        Belum ada konten catatan.
      </div>
    );
  }

  // Split lines while preserving blocks
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const nodes: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let codeBlockLang = '';

  let inList: 'ul' | 'ol' | null = null;
  let listItems: React.ReactNode[] = [];

  const flushList = () => {
    if (inList === 'ul') {
      nodes.push(
        <ul key={`ul-${nodes.length}`} className="my-3 ml-6 list-disc space-y-1 text-sm text-foreground">
          {listItems}
        </ul>
      );
    } else if (inList === 'ol') {
      nodes.push(
        <ol key={`ol-${nodes.length}`} className="my-3 ml-6 list-decimal space-y-1 text-sm text-foreground">
          {listItems}
        </ol>
      );
    }
    inList = null;
    listItems = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]!;

    // Code block toggle (```)
    if (rawLine.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        nodes.push(
          <div key={`code-block-${nodes.length}`} className="my-4 overflow-x-auto rounded-lg border border-border bg-muted/60 p-4">
            {codeBlockLang && (
              <div className="mb-2 text-xs font-mono text-muted-foreground uppercase tracking-wider font-semibold">
                {codeBlockLang}
              </div>
            )}
            <pre className="font-mono text-xs text-foreground leading-relaxed">
              <code>{codeBlockLines.join('\n')}</code>
            </pre>
          </div>
        );
        inCodeBlock = false;
        codeBlockLines = [];
        codeBlockLang = '';
      } else {
        flushList();
        inCodeBlock = true;
        codeBlockLang = rawLine.trim().replace(/^```/, '').trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    const trimmed = rawLine.trim();

    // Empty line
    if (!trimmed) {
      flushList();
      continue;
    }

    // Horizontal Rule (--- or ***)
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
      flushList();
      nodes.push(<hr key={`hr-${nodes.length}`} className="my-6 border-t border-border" />);
      continue;
    }

    // Headings
    if (trimmed.startsWith('# ')) {
      flushList();
      nodes.push(
        <h1 key={`h1-${nodes.length}`} className="mt-6 mb-3 text-2xl font-bold tracking-tight text-foreground border-b border-border pb-1">
          {renderInline(trimmed.slice(2))}
        </h1>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      nodes.push(
        <h2 key={`h2-${nodes.length}`} className="mt-5 mb-2.5 text-xl font-semibold tracking-tight text-foreground border-b border-border pb-1">
          {renderInline(trimmed.slice(3))}
        </h2>
      );
      continue;
    }
    if (trimmed.startsWith('### ')) {
      flushList();
      nodes.push(
        <h3 key={`h3-${nodes.length}`} className="mt-4 mb-2 text-lg font-semibold text-foreground">
          {renderInline(trimmed.slice(4))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('#### ')) {
      flushList();
      nodes.push(
        <h4 key={`h4-${nodes.length}`} className="mt-3 mb-1.5 text-base font-semibold text-foreground">
          {renderInline(trimmed.slice(5))}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith('##### ')) {
      flushList();
      nodes.push(
        <h5 key={`h5-${nodes.length}`} className="mt-3 mb-1 text-sm font-semibold text-foreground">
          {renderInline(trimmed.slice(6))}
        </h5>
      );
      continue;
    }
    if (trimmed.startsWith('###### ')) {
      flushList();
      nodes.push(
        <h6 key={`h6-${nodes.length}`} className="mt-2 mb-1 text-xs font-semibold uppercase text-muted-foreground">
          {renderInline(trimmed.slice(7))}
        </h6>
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      flushList();
      const quoteText = trimmed.replace(/^>\s?/, '');
      nodes.push(
        <blockquote
          key={`quote-${nodes.length}`}
          className="my-3 border-l-4 border-primary pl-4 italic text-sm text-muted-foreground"
        >
          {renderInline(quoteText)}
        </blockquote>
      );
      continue;
    }

    // Unordered List (- or * or +)
    const ulMatch = /^[-*+]\s+(.*)$/.exec(trimmed);
    if (ulMatch) {
      if (inList !== 'ul') {
        flushList();
        inList = 'ul';
      }
      listItems.push(
        <li key={`li-${listItems.length}`} className="leading-relaxed">
          {renderInline(ulMatch[1]!)}
        </li>
      );
      continue;
    }

    // Ordered List (1. 2.)
    const olMatch = /^(\d+)\.\s+(.*)$/.exec(trimmed);
    if (olMatch) {
      if (inList !== 'ol') {
        flushList();
        inList = 'ol';
      }
      listItems.push(
        <li key={`li-${listItems.length}`} className="leading-relaxed">
          {renderInline(olMatch[2]!)}
        </li>
      );
      continue;
    }

    // Normal Paragraph
    flushList();
    nodes.push(
      <p key={`p-${nodes.length}`} className="my-2.5 text-sm leading-relaxed text-foreground">
        {renderInline(rawLine)}
      </p>
    );
  }

  // Clean up any remaining block
  flushList();
  if (inCodeBlock && codeBlockLines.length > 0) {
    nodes.push(
      <div key={`code-block-unclosed-${nodes.length}`} className="my-4 overflow-x-auto rounded-lg border border-border bg-muted/60 p-4">
        <pre className="font-mono text-xs text-foreground leading-relaxed">
          <code>{codeBlockLines.join('\n')}</code>
        </pre>
      </div>
    );
  }

  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none break-words ${className}`}>
      {nodes}
    </div>
  );
}
