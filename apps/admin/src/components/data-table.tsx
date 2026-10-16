"use client"

import * as React from "react"
import Link from "next/link"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  CheckCircle2Icon,
  AlertTriangleIcon,
  XCircleIcon,
  HelpCircleIcon,
  ChevronDownIcon,
  ColumnsIcon,
  RefreshCwIcon,
  ExternalLinkIcon,
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  InfoIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { fetchAdminSystemStatus } from "@/lib/admin-api"
import type {
  AdminSystemModule,
  AdminModuleStatus,
  AdminModuleCategory,
} from "@studyflow/shared"

function getStatusBadge(status: AdminModuleStatus) {
  switch (status) {
    case "HEALTHY":
      return (
        <Badge
          variant="outline"
          className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 font-medium text-xs px-2.5 py-0.5"
        >
          <CheckCircle2Icon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Normal</span>
        </Badge>
      )
    case "DEGRADED":
      return (
        <Badge
          variant="outline"
          className="gap-1.5 border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 font-medium text-xs px-2.5 py-0.5"
        >
          <AlertTriangleIcon className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>Degradasi</span>
        </Badge>
      )
    case "UNAVAILABLE":
      return (
        <Badge
          variant="outline"
          className="gap-1.5 border-destructive/20 bg-destructive/10 text-destructive font-medium text-xs px-2.5 py-0.5"
        >
          <XCircleIcon className="h-3.5 w-3.5 text-destructive shrink-0" />
          <span>Terputus</span>
        </Badge>
      )
    case "UNCONFIGURED":
    default:
      return (
        <Badge
          variant="outline"
          className="gap-1.5 border-border bg-muted/60 text-muted-foreground font-medium text-xs px-2.5 py-0.5"
        >
          <HelpCircleIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span>Belum Dikonfigurasi</span>
        </Badge>
      )
  }
}

function getCategoryBadge(category: AdminModuleCategory) {
  switch (category) {
    case "DATABASE":
      return <Badge variant="secondary" className="text-xs font-normal">Basis Data</Badge>
    case "QUEUE_WORKER":
      return <Badge variant="secondary" className="text-xs font-normal">Worker & Antrean</Badge>
    case "STORAGE":
      return <Badge variant="secondary" className="text-xs font-normal">Penyimpanan</Badge>
    case "AI_PIPELINE":
      return <Badge variant="secondary" className="text-xs font-normal">Pipeline AI</Badge>
    case "SECURITY":
      return <Badge variant="secondary" className="text-xs font-normal">Keamanan & Auth</Badge>
    default:
      return <Badge variant="secondary" className="text-xs font-normal">{category}</Badge>
  }
}

function ModuleDetailSheet({ module }: { module: AdminSystemModule }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground">
          <InfoIcon className="h-3.5 w-3.5 mr-1" />
          Rincian
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex flex-col sm:max-w-md w-full">
        <SheetHeader className="gap-1">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-base font-semibold">{module.name}</SheetTitle>
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            Informasi status operasional dan konfigurasi komponen sistem StudyFlow.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Status Operasional</span>
            <div>{getStatusBadge(module.status)}</div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Kategori</span>
            <div>{getCategoryBadge(module.category)}</div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Engine / Runtime</span>
            <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{module.engine}</span>
          </div>
          <Separator />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">{module.metricLabel}</span>
            <span className="text-sm font-semibold text-foreground">{module.metricValue}</span>
          </div>
          <Separator />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Deskripsi Fungsi</span>
            <p className="text-xs text-foreground/80 leading-relaxed bg-muted/50 p-3 rounded-lg border">
              {module.description}
            </p>
          </div>

          {module.details && (
            <>
              <Separator />
              <div className="flex flex-col gap-2">
                <span className="text-xs text-muted-foreground">Rincian Antrean Memori</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(module.details).map(([key, val]) => (
                    <div key={key} className="flex justify-between bg-muted/40 p-2 rounded border">
                      <span className="capitalize text-muted-foreground">{key}:</span>
                      <span className="font-medium font-mono">{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Diperbarui pada</span>
            <span>
              {new Date(module.updatedAt).toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })} WIB
            </span>
          </div>

          {module.category === "QUEUE_WORKER" && (
            <div className="mt-auto pt-4">
              <Button asChild variant="outline" className="w-full gap-2 text-xs">
                <Link href="/jobs">
                  <ExternalLinkIcon className="h-3.5 w-3.5" />
                  Buka Monitoring Pekerjaan
                </Link>
              </Button>
            </div>
          )}
          {module.category === "DATABASE" && (
            <div className="mt-auto pt-4">
              <Button asChild variant="outline" className="w-full gap-2 text-xs">
                <Link href="/users">
                  <ExternalLinkIcon className="h-3.5 w-3.5" />
                  Lihat Direktori Pengguna
                </Link>
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

const columns: ColumnDef<AdminSystemModule>[] = [
  {
    accessorKey: "name",
    header: "Komponen / Layanan",
    cell: ({ row }) => (
      <div className="flex flex-col max-w-[280px]">
        <span className="font-medium text-foreground">{row.original.name}</span>
        <span className="text-xs text-muted-foreground line-clamp-1">
          {row.original.description}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "category",
    header: "Kategori",
    cell: ({ row }) => getCategoryBadge(row.original.category),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => getStatusBadge(row.original.status),
  },
  {
    accessorKey: "engine",
    header: "Engine / Runtime",
    cell: ({ row }) => (
      <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
        {row.original.engine}
      </span>
    ),
  },
  {
    accessorKey: "metricValue",
    header: "Metrik Operasional",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="text-xs font-medium text-foreground">{row.original.metricValue}</span>
        <span className="text-xs text-muted-foreground">{row.original.metricLabel}</span>
      </div>
    ),
  },
  {
    id: "actions",
    header: () => <div className="text-right">Aksi</div>,
    cell: ({ row }) => (
      <div className="text-right">
        <ModuleDetailSheet module={row.original} />
      </div>
    ),
  },
]

export function DataTable() {
  const [modules, setModules] = React.useState<AdminSystemModule[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [activeTab, setActiveTab] = React.useState<string>("all")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [sorting, setSorting] = React.useState<SortingState>([])

  const loadStatus = React.useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetchAdminSystemStatus({ signal })
      setModules(res.modules)
    } catch (err: any) {
      if (err.name === 'AbortError') return
      setError(err.message || 'Gagal memuat status modul sistem')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    const controller = new AbortController()
    loadStatus(controller.signal)
    return () => {
      controller.abort()
    }
  }, [loadStatus])

  // Filter based on active tab and search query
  const filteredModules = React.useMemo(() => {
    return modules.filter((m) => {
      // Tab filter
      if (activeTab === "workers" && m.category !== "QUEUE_WORKER") return false
      if (activeTab === "data" && m.category !== "DATABASE" && m.category !== "STORAGE") return false
      if (activeTab === "ai-security" && m.category !== "AI_PIPELINE" && m.category !== "SECURITY") return false

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = m.name.toLowerCase().includes(q)
        const matchesEngine = m.engine.toLowerCase().includes(q)
        const matchesDesc = m.description.toLowerCase().includes(q)
        const matchesMetric = m.metricValue.toLowerCase().includes(q)
        if (!matchesName && !matchesEngine && !matchesDesc && !matchesMetric) return false
      }

      return true
    })
  }, [modules, activeTab, searchQuery])

  // Counts for tabs
  const tabCounts = React.useMemo(() => {
    return {
      all: modules.length,
      workers: modules.filter((m) => m.category === "QUEUE_WORKER").length,
      data: modules.filter((m) => m.category === "DATABASE" || m.category === "STORAGE").length,
      aiSecurity: modules.filter((m) => m.category === "AI_PIPELINE" || m.category === "SECURITY").length,
    }
  }, [modules])

  const table = useReactTable({
    data: filteredModules,
    columns,
    state: {
      sorting,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 lg:px-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
            Kesehatan Komponen & Infrastruktur Sistem
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Status konektivitas riil PostgreSQL, antrean BullMQ Redis, object storage, dan pipeline AI.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadStatus()}
          disabled={isLoading}
          className="gap-2 self-start sm:self-auto h-8 px-3 text-xs shadow-xs"
        >
          <RefreshCwIcon className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Segarkan Status
        </Button>
      </div>

      {error && (
        <div className="px-4 lg:px-6">
          <Alert variant="destructive">
            <AlertTitle>Gagal Memuat Komponen Sistem</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-4 mt-1">
              <span>{error}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadStatus()}
                className="bg-card text-foreground"
              >
                Coba Lagi
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex w-full flex-col justify-start gap-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 lg:px-6">
          {/* Mobile Select */}
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="sm:hidden flex w-full h-8 text-xs">
              <SelectValue placeholder="Pilih Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Komponen ({tabCounts.all})</SelectItem>
              <SelectItem value="workers">Worker & Antrean ({tabCounts.workers})</SelectItem>
              <SelectItem value="data">Basis Data & Storage ({tabCounts.data})</SelectItem>
              <SelectItem value="ai-security">AI & Keamanan ({tabCounts.aiSecurity})</SelectItem>
            </SelectContent>
          </Select>

          {/* Desktop Tabs */}
          <TabsList className="hidden sm:flex h-9 p-1">
            <TabsTrigger value="all" className="gap-1.5 text-xs">
              Semua Komponen
              <Badge variant="secondary" className="px-1.5 py-0 text-xs font-semibold tabular-nums h-4">
                {tabCounts.all}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="workers" className="gap-1.5 text-xs">
              Worker & Antrean
              <Badge variant="secondary" className="px-1.5 py-0 text-xs font-semibold tabular-nums h-4">
                {tabCounts.workers}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="data" className="gap-1.5 text-xs">
              Basis Data & Storage
              <Badge variant="secondary" className="px-1.5 py-0 text-xs font-semibold tabular-nums h-4">
                {tabCounts.data}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="ai-security" className="gap-1.5 text-xs">
              AI & Keamanan
              <Badge variant="secondary" className="px-1.5 py-0 text-xs font-semibold tabular-nums h-4">
                {tabCounts.aiSecurity}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-56">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Cari komponen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                  <ColumnsIcon className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Kolom</span>
                  <ChevronDownIcon className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => {
                    const columnNames: Record<string, string> = {
                      name: "Komponen",
                      category: "Kategori",
                      status: "Status",
                      engine: "Engine",
                      metricValue: "Metrik",
                    }
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="text-xs capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(val) => column.toggleVisibility(!!val)}
                      >
                        {columnNames[column.id] || column.id}
                      </DropdownMenuCheckboxItem>
                    )
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <TabsContent value={activeTab} className="px-4 lg:px-6 mt-0">
          <div className="rounded-lg border bg-card overflow-x-auto shadow-xs">
            {isLoading && modules.length === 0 ? (
              <div className="p-4 flex flex-col gap-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : filteredModules.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Tidak ada komponen sistem yang cocok dengan kriteria filter atau pencarian.
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} className="text-xs h-9">
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/30">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-2.5 text-xs">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
