'use client';

import * as React from 'react';
import {
  Heading1,
  Heading2,
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Minus,
  Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface NoteMarkdownToolbarProps {
  onInsertFormatting: (prefix: string, suffix?: string, placeholder?: string) => void;
}

export function NoteMarkdownToolbar({
  onInsertFormatting,
}: NoteMarkdownToolbarProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-0.5 overflow-x-auto py-0.5">
      {/* Heading group */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => onInsertFormatting('# ', '', 'Judul')}
        title="Heading 1 (# Judul)"
        aria-label="Format Heading 1"
      >
        <Heading1 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => onInsertFormatting('## ', '', 'Subjudul')}
        title="Heading 2 (## Subjudul)"
        aria-label="Format Heading 2"
      >
        <Heading2 className="h-4 w-4" />
      </Button>

      <div className="h-4 w-px bg-border/80 mx-1 shrink-0" />

      {/* Inline formatting group */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => onInsertFormatting('**', '**', 'teks tebal')}
        title="Tebal (**teks**)"
        aria-label="Format Tebal"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => onInsertFormatting('*', '*', 'teks miring')}
        title="Miring (*teks*)"
        aria-label="Format Miring"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => onInsertFormatting('~~', '~~', 'teks dicoret')}
        title="Coret (~~teks~~)"
        aria-label="Format Coret"
      >
        <Strikethrough className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => onInsertFormatting('`', '`', 'kode')}
        title="Kode inline (`kode`)"
        aria-label="Format Kode Inline"
      >
        <Code className="h-4 w-4" />
      </Button>

      <div className="h-4 w-px bg-border/80 mx-1 shrink-0" />

      {/* Block and list group */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => onInsertFormatting('- ', '', 'Poin daftar')}
        title="Daftar Poin (- Poin)"
        aria-label="Format Daftar Poin"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => onInsertFormatting('1. ', '', 'Poin nomor')}
        title="Daftar Nomor (1. Poin)"
        aria-label="Format Daftar Nomor"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => onInsertFormatting('> ', '', 'Kutipan')}
        title="Kutipan (> Kutipan)"
        aria-label="Format Kutipan"
      >
        <Quote className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => onInsertFormatting('\n---\n', '', '')}
        title="Garis Pemisah (---)"
        aria-label="Format Garis Pemisah"
      >
        <Minus className="h-4 w-4" />
      </Button>

      <div className="h-4 w-px bg-border/80 mx-1 shrink-0" />

      {/* Link group */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => onInsertFormatting('[', '](https://example.com)', 'Nama tautan')}
        title="Tautan ([Nama](https://...))"
        aria-label="Format Tautan"
      >
        <Link2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
