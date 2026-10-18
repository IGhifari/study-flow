'use client';

import * as React from 'react';
import { Edit3, Eye, Columns2, FileText, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AnimatedPanel } from '@/components/ui/motion';
import { SafeMarkdownRenderer } from '@/components/notes/markdown-renderer';
import { NoteMarkdownToolbar } from '@/components/notes/note-markdown-toolbar';

export interface NoteStats {
  words: number;
  chars: number;
  readTimeMinutes: number;
}

export interface NoteEditorCardProps {
  activeTab: string;
  onActiveTabChange: (tab: string) => void;
  content: string;
  onContentChange: (content: string) => void;
  isArchived: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onInsertFormatting: (prefix: string, suffix?: string, placeholder?: string) => void;
  stats: NoteStats;
}

export function NoteEditorCard({
  activeTab,
  onActiveTabChange,
  content,
  onContentChange,
  isArchived,
  textareaRef,
  onInsertFormatting,
  stats,
}: NoteEditorCardProps): React.JSX.Element {
  return (
    <Tabs value={activeTab} onValueChange={onActiveTabChange} className="w-full">
      <Card className="overflow-hidden border border-border/80 bg-card shadow-xs rounded-xl">
        {/* Tab List & Formatting Toolbar */}
        <div className="flex flex-wrap items-center justify-between border-b border-border/80 bg-muted/40 p-2 sm:px-3 gap-2">
          <TabsList className="h-9">
            <TabsTrigger value="write" className="gap-1.5 text-xs">
              <Edit3 className="h-3.5 w-3.5" />
              <span>Tulis</span>
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1.5 text-xs">
              <Eye className="h-3.5 w-3.5" />
              <span>Pratinjau</span>
            </TabsTrigger>
            <TabsTrigger value="split" className="hidden xl:inline-flex gap-1.5 text-xs">
              <Columns2 className="h-3.5 w-3.5" />
              <span>Berdampingan</span>
            </TabsTrigger>
          </TabsList>

          {/* Markdown Quick Toolbar (Shown in Write and Split tabs) */}
          {(activeTab === 'write' || activeTab === 'split') && !isArchived && (
            <NoteMarkdownToolbar onInsertFormatting={onInsertFormatting} />
          )}
        </div>

        {/* Tab Content: Write */}
        <TabsContent value="write" className="m-0 p-4 sm:p-6">
          <AnimatedPanel panelKey="write-panel">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              disabled={isArchived}
              placeholder="Tulis catatan menggunakan format Markdown di sini... Gunakan toolbar di atas untuk memformat teks dengan cepat."
              rows={24}
              className="w-full resize-y rounded-lg bg-transparent p-2 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-hidden border-none min-h-[500px]"
            />
          </AnimatedPanel>
        </TabsContent>

        {/* Tab Content: Preview */}
        <TabsContent value="preview" className="m-0 p-6 min-h-[520px] bg-background/40">
          <AnimatedPanel panelKey="preview-panel">
            {content.trim() ? (
              <div className="max-w-3xl mx-auto py-2">
                <SafeMarkdownRenderer content={content} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="rounded-full bg-muted/60 p-4 mb-3 text-muted-foreground">
                  <FileText className="h-8 w-8" />
                </div>
                <h4 className="text-base font-semibold text-foreground">
                  Belum ada konten untuk dipratinjau
                </h4>
                <p className="text-sm text-muted-foreground max-w-sm mt-1">
                  Tulis rangkuman dan catatan Anda di tab Tulis dengan format Markdown, lalu lihat hasil tampilannya di sini.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onActiveTabChange('write')}
                  className="mt-4 gap-1.5 text-xs"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Mulai Menulis
                </Button>
              </div>
            )}
          </AnimatedPanel>
        </TabsContent>

        {/* Tab Content: Live Split Preview (xl desktop) */}
        <TabsContent value="split" className="m-0">
          <AnimatedPanel panelKey="split-panel">
            <div className="grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x divide-border/80 min-h-[520px]">
              <div className="p-4 sm:p-6">
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => onContentChange(e.target.value)}
                  disabled={isArchived}
                  placeholder="Tulis catatan menggunakan format Markdown di sini... Pratinjau langsung tampil di sisi kanan."
                  rows={24}
                  className="w-full resize-y rounded-lg bg-transparent p-2 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-hidden border-none min-h-[500px]"
                />
              </div>
              <div className="p-4 sm:p-6 bg-background/40 overflow-y-auto max-h-[680px]">
                {content.trim() ? (
                  <SafeMarkdownRenderer content={content} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-16 text-center text-muted-foreground">
                    <FileText className="h-7 w-7 mb-2 opacity-60" />
                    <p className="text-xs">Pratinjau Markdown langsung akan tampil saat Anda mengetik.</p>
                  </div>
                )}
              </div>
            </div>
          </AnimatedPanel>
        </TabsContent>

        {/* Footer Bar: Stats & Hints */}
        <div className="flex flex-wrap items-center justify-between border-t border-border/80 bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground gap-2">
          <div className="flex items-center gap-3 tabular-nums">
            <span>{stats.words.toLocaleString('id-ID')} kata</span>
            <span>•</span>
            <span>{stats.chars.toLocaleString('id-ID')} karakter</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              ±{stats.readTimeMinutes} menit baca
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground">
              Ctrl+S
            </kbd>
            <span>untuk menyimpan</span>
          </div>
        </div>
      </Card>
    </Tabs>
  );
}
