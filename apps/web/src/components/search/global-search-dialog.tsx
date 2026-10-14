'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  BookOpen,
  Files,
  ListTodo,
  FileText,
  Loader2,
  AlertCircle,
  RotateCcw,
  X,
  CalendarRange,
  ArrowRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import {
  Semester,
  SearchResultItem,
  SearchResponse,
} from '@studyflow/shared';
import { listSemesters } from '@/lib/semester-client';
import { searchGlobalClient } from '@/lib/search-client';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface GlobalSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearchDialog({
  isOpen,
  onClose,
}: GlobalSearchDialogProps): React.JSX.Element {
  const router = useRouter();

  // Search query & scope
  const [query, setQuery] = React.useState('');
  const [semesterScope, setSemesterScope] = React.useState<string>('active'); // 'active' or 'all'
  const [semesters, setSemesters] = React.useState<Semester[]>([]);
  const [activeSemester, setActiveSemester] = React.useState<Semester | null>(null);

  // Results & async states
  const [isLoading, setIsLoading] = React.useState(false);
  const [searchResponse, setSearchResponse] = React.useState<SearchResponse | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Keyboard navigation index in flattened results
  const [selectedIndex, setSelectedIndex] = React.useState<number>(0);

  // Request race condition guards
  const fetchRequestIdRef = React.useRef(0);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const resultsContainerRef = React.useRef<HTMLDivElement | null>(null);

  // 1. Load active semester and available semesters
  const loadSemesterContext = React.useCallback(async () => {
    try {
      const res = await listSemesters('all');
      setSemesters(res.semesters);
      setActiveSemester(res.activeSemester);
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      loadSemesterContext();
    }
  }, [isOpen, loadSemesterContext]);

  // Listen to semester changes from elsewhere
  React.useEffect(() => {
    const handleSemesterChange = () => {
      loadSemesterContext();
    };
    window.addEventListener('studyflow:semester-changed', handleSemesterChange);
    return () => {
      window.removeEventListener('studyflow:semester-changed', handleSemesterChange);
    };
  }, [loadSemesterContext]);

  // Reset state when dialog closes (no persistent cross-session caching)
  React.useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSearchResponse(null);
      setErrorMessage(null);
      setIsLoading(false);
      setSelectedIndex(0);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    } else {
      // Autofocus input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // 2. Perform debounced search (300ms)
  const performSearch = React.useCallback(
    async (q: string, scope: string, targetActiveSem: Semester | null) => {
      const trimmed = q.trim();
      if (trimmed.length < 2) {
        setSearchResponse(null);
        setIsLoading(false);
        setErrorMessage(null);
        return;
      }

      // Cancel previous in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const requestId = ++fetchRequestIdRef.current;
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const semesterParam =
          scope === 'all'
            ? 'all'
            : targetActiveSem
            ? targetActiveSem.id
            : undefined;

        const data = await searchGlobalClient(
          {
            q: trimmed,
            semesterId: semesterParam,
            limit: 5,
          },
          controller.signal
        );

        if (requestId === fetchRequestIdRef.current) {
          setSearchResponse(data);
          setSelectedIndex(0);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        if (requestId === fetchRequestIdRef.current) {
          setErrorMessage(err.message || 'Gagal memuat hasil pencarian');
        }
      } finally {
        if (requestId === fetchRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  React.useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query, semesterScope, activeSemester);
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [query, semesterScope, activeSemester, performSearch]);

  // Flattened results for keyboard navigation
  const flattenedItems = React.useMemo<SearchResultItem[]>(() => {
    if (!searchResponse) return [];
    return [
      ...searchResponse.results.courses,
      ...searchResponse.results.materials,
      ...searchResponse.results.assignments,
      ...searchResponse.results.notes,
    ];
  }, [searchResponse]);

  // 3. Handle navigation to an item
  const handleSelectItem = React.useCallback(
    (item: SearchResultItem) => {
      onClose();
      router.push(item.url);
    },
    [onClose, router]
  );

  // 4. Keyboard navigation (ArrowDown, ArrowUp, Enter)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (flattenedItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % flattenedItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + flattenedItems.length) % flattenedItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = flattenedItems[selectedIndex];
      if (current) {
        handleSelectItem(current);
      }
    }
  };

  // Scroll active item into view
  React.useEffect(() => {
    if (resultsContainerRef.current) {
      const activeEl = resultsContainerRef.current.querySelector('[data-selected="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  let cumulativeIndex = 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-2xl w-[95vw] sm:w-full p-0 gap-0 overflow-hidden border shadow-2xl rounded-2xl bg-card"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Pencarian Global StudyFlow</DialogTitle>

        {/* Input & Search Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b bg-muted/20">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="search"
            role="searchbox"
            aria-label="Cari mata kuliah, materi, tugas, dan catatan"
            placeholder="Cari mata kuliah, materi, tugas, atau catatan..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-sm sm:text-base font-medium placeholder:text-muted-foreground/70 focus:outline-hidden text-foreground"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />

          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
          )}

          {query.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Bersihkan input"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Scope Toggle: Semester Aktif vs Semua Semester */}
          <div className="flex items-center gap-1 shrink-0 pl-1 border-l border-border/80">
            <button
              type="button"
              onClick={() =>
                setSemesterScope((prev) => (prev === 'active' ? 'all' : 'active'))
              }
              className={cn(
                'text-xs font-semibold px-2 py-1 rounded-md transition-colors flex items-center gap-1 border',
                semesterScope === 'all'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/80 text-foreground border-border hover:bg-muted'
              )}
              title={
                semesterScope === 'all'
                  ? 'Cakupan: Semua semester. Klik untuk beralih ke semester aktif.'
                  : `Cakupan: ${activeSemester?.name || 'Semester Aktif'}. Klik untuk beralih ke semua semester.`
              }
            >
              <CalendarRange className="h-3 w-3" />
              <span className="hidden sm:inline">
                {semesterScope === 'all' ? 'Semua Semester' : activeSemester?.name || 'Semester Aktif'}
              </span>
              <span className="sm:hidden">
                {semesterScope === 'all' ? 'Semua' : 'Aktif'}
              </span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div
          ref={resultsContainerRef}
          className="max-h-[60vh] sm:max-h-[420px] overflow-y-auto p-2 space-y-4"
        >
          {/* Error Message */}
          {errorMessage && (
            <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => performSearch(query, semesterScope, activeSemester)}
                className="h-7 text-xs gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Coba Lagi
              </Button>
            </div>
          )}

          {/* Empty Query Prompt */}
          {query.trim().length === 0 && (
            <div className="py-10 text-center space-y-2 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto opacity-40" />
              <p className="text-sm font-medium text-foreground/80">
                Ketik nama materi, tugas, catatan, atau mata kuliah
              </p>
              <p className="text-xs max-w-xs mx-auto text-muted-foreground/70">
                Pencarian mencocokkan judul materi, tugas, catatan, serta nama dan kode mata kuliah secara instan.
              </p>
            </div>
          )}

          {/* Query Too Short Prompt (< 2 chars) */}
          {query.trim().length === 1 && (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Ketik minimal 2 karakter untuk mulai mencari...
            </div>
          )}

          {/* No Results State */}
          {!isLoading &&
            query.trim().length >= 2 &&
            searchResponse &&
            flattenedItems.length === 0 && (
              <div className="py-10 text-center space-y-3 text-muted-foreground">
                <p className="text-sm font-medium text-foreground">
                  Tidak ada hasil untuk &ldquo;<span className="text-primary font-semibold">{query}</span>&rdquo;
                </p>
                <p className="text-xs max-w-sm mx-auto">
                  {semesterScope !== 'all' ? (
                    <>
                      Tidak ditemukan pada {searchResponse.semesterScope.name}. Coba beralih ke{' '}
                      <button
                        type="button"
                        onClick={() => setSemesterScope('all')}
                        className="text-primary underline font-semibold hover:text-primary/80"
                      >
                        Semua Semester
                      </button>{' '}
                      atau periksa ejaan kata kunci.
                    </>
                  ) : (
                    'Periksa kembali ejaan kata kunci Anda atau coba kata kunci yang lebih umum.'
                  )}
                </p>
              </div>
            )}

          {/* Categorized Results */}
          {searchResponse && flattenedItems.length > 0 && (
            <div className="space-y-4">
              {/* Category: Mata Kuliah */}
              {searchResponse.results.courses.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2 py-1 flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5 text-primary" />
                      Mata Kuliah
                    </span>
                    {searchResponse.hasMore.courses && (
                      <span className="text-[10px] lowercase font-normal opacity-70">
                        (5 teratas)
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {searchResponse.results.courses.map((item) => {
                      const itemIdx = cumulativeIndex++;
                      const isSelected = itemIdx === selectedIndex;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          data-selected={isSelected}
                          onClick={() => handleSelectItem(item)}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          className={cn(
                            'w-full text-left px-3 py-2.5 rounded-xl transition-colors flex items-center justify-between gap-3 group text-sm',
                            isSelected
                              ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                              : 'hover:bg-muted/60 text-foreground'
                          )}
                        >
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{item.title}</div>
                            <div
                              className={cn(
                                'text-xs truncate font-normal mt-0.5',
                                isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                              )}
                            >
                              {item.subtitle}
                            </div>
                          </div>
                          <ArrowRight
                            className={cn(
                              'h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5',
                              isSelected ? 'text-primary-foreground' : 'text-muted-foreground/60'
                            )}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category: Materi */}
              {searchResponse.results.materials.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2 py-1 flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Files className="h-3.5 w-3.5 text-blue-500" />
                      Materi
                    </span>
                    {searchResponse.hasMore.materials && (
                      <span className="text-[10px] lowercase font-normal opacity-70">
                        (5 teratas)
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {searchResponse.results.materials.map((item) => {
                      const itemIdx = cumulativeIndex++;
                      const isSelected = itemIdx === selectedIndex;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          data-selected={isSelected}
                          onClick={() => handleSelectItem(item)}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          className={cn(
                            'w-full text-left px-3 py-2.5 rounded-xl transition-colors flex items-center justify-between gap-3 group text-sm',
                            isSelected
                              ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                              : 'hover:bg-muted/60 text-foreground'
                          )}
                        >
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{item.title}</div>
                            <div
                              className={cn(
                                'text-xs truncate font-normal mt-0.5',
                                isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                              )}
                            >
                              {item.subtitle}
                            </div>
                          </div>
                          <ArrowRight
                            className={cn(
                              'h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5',
                              isSelected ? 'text-primary-foreground' : 'text-muted-foreground/60'
                            )}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category: Tugas */}
              {searchResponse.results.assignments.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2 py-1 flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <ListTodo className="h-3.5 w-3.5 text-amber-500" />
                      Tugas Kuliah
                    </span>
                    {searchResponse.hasMore.assignments && (
                      <span className="text-[10px] lowercase font-normal opacity-70">
                        (5 teratas)
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {searchResponse.results.assignments.map((item) => {
                      const itemIdx = cumulativeIndex++;
                      const isSelected = itemIdx === selectedIndex;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          data-selected={isSelected}
                          onClick={() => handleSelectItem(item)}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          className={cn(
                            'w-full text-left px-3 py-2.5 rounded-xl transition-colors flex items-center justify-between gap-3 group text-sm',
                            isSelected
                              ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                              : 'hover:bg-muted/60 text-foreground'
                          )}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold truncate">{item.title}</span>
                              {item.metadata?.isOverdue && (
                                <Badge variant="danger" className="text-[10px] py-0 px-1.5 h-4">
                                  Terlewat
                                </Badge>
                              )}
                              {item.metadata?.status === 'DONE' && (
                                <Badge variant="success" className="text-[10px] py-0 px-1.5 h-4">
                                  Selesai
                                </Badge>
                              )}
                            </div>
                            <div
                              className={cn(
                                'text-xs truncate font-normal mt-0.5',
                                isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                              )}
                            >
                              {item.subtitle}
                            </div>
                          </div>
                          <ArrowRight
                            className={cn(
                              'h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5',
                              isSelected ? 'text-primary-foreground' : 'text-muted-foreground/60'
                            )}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category: Catatan */}
              {searchResponse.results.notes.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2 py-1 flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-emerald-500" />
                      Catatan
                    </span>
                    {searchResponse.hasMore.notes && (
                      <span className="text-[10px] lowercase font-normal opacity-70">
                        (5 teratas)
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {searchResponse.results.notes.map((item) => {
                      const itemIdx = cumulativeIndex++;
                      const isSelected = itemIdx === selectedIndex;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          data-selected={isSelected}
                          onClick={() => handleSelectItem(item)}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          className={cn(
                            'w-full text-left px-3 py-2.5 rounded-xl transition-colors flex items-center justify-between gap-3 group text-sm',
                            isSelected
                              ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                              : 'hover:bg-muted/60 text-foreground'
                          )}
                        >
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{item.title}</div>
                            <div
                              className={cn(
                                'text-xs truncate font-normal mt-0.5',
                                isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                              )}
                            >
                              {item.subtitle}
                            </div>
                          </div>
                          <ArrowRight
                            className={cn(
                              'h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5',
                              isSelected ? 'text-primary-foreground' : 'text-muted-foreground/60'
                            )}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with keyboard shortcuts hints */}
        <div className="px-4 py-2.5 bg-muted/40 border-t flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono text-[10px]">↓</kbd>
              <span>pilih</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono text-[10px]">↵</kbd>
              <span>buka</span>
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono text-[10px]">ESC</kbd>
            <span>tutup</span>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
