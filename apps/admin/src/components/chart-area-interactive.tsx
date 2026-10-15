"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { AlertCircle, RefreshCw } from "lucide-react"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { fetchAdminTrends } from "@/lib/admin-api"
import type { AdminTrendRange, AdminTrendsResponse } from "@studyflow/shared"

const chartConfig = {
  materi: {
    label: "Materi Kuliah",
    color: "var(--chart-1)",
  },
  tugas: {
    label: "Tugas Kuliah",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState<AdminTrendRange>("30d")
  const [trends, setTrends] = React.useState<AdminTrendsResponse | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  const loadTrends = React.useCallback(async (range: AdminTrendRange, signal?: AbortSignal) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetchAdminTrends(range, { signal })
      setTrends(res)
    } catch (err: any) {
      if (err.name === 'AbortError') return
      setError(err.message || 'Gagal memuat tren aktivitas platform')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    const controller = new AbortController()
    loadTrends(timeRange, controller.signal)
    return () => {
      controller.abort()
    }
  }, [timeRange, loadTrends])

  const rangeLabels: Record<AdminTrendRange, string> = {
    '7d': '7 Hari Terakhir',
    '30d': '30 Hari Terakhir',
    '90d': '3 Bulan Terakhir',
  }

  const totals = trends?.totals ?? { materi: 0, tugas: 0 }
  const chartData = trends?.data ?? []

  return (
    <Card className="@container/card shadow-xs">
      <CardHeader className="relative flex flex-col gap-1 pb-4">
        <CardTitle className="text-lg font-semibold tracking-tight md:text-xl">
          Tren Aktivitas Platform
        </CardTitle>
        <CardDescription>
          {trends ? (
            <>
              <span className="@[540px]/card:block hidden">
                Volume materi perkuliahan diunggah ({totals.materi}) dan pembuatan tugas ({totals.tugas}) dalam {rangeLabels[timeRange].toLowerCase()}
              </span>
              <span className="@[540px]/card:hidden">
                {totals.materi} Materi • {totals.tugas} Tugas ({timeRange})
              </span>
            </>
          ) : (
            <span>Memuat data aktivitas platform...</span>
          )}
        </CardDescription>
        <div className="absolute right-4 top-4">
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={(val) => {
              if (val) setTimeRange(val as AdminTrendRange)
            }}
            variant="outline"
            className="@[767px]/card:flex hidden"
          >
            <ToggleGroupItem value="90d" className="h-8 px-2.5 text-xs">
              3 Bulan
            </ToggleGroupItem>
            <ToggleGroupItem value="30d" className="h-8 px-2.5 text-xs">
              30 Hari
            </ToggleGroupItem>
            <ToggleGroupItem value="7d" className="h-8 px-2.5 text-xs">
              7 Hari
            </ToggleGroupItem>
          </ToggleGroup>
          <Select
            value={timeRange}
            onValueChange={(val) => {
              if (val) setTimeRange(val as AdminTrendRange)
            }}
          >
            <SelectTrigger
              className="@[767px]/card:hidden flex w-32 h-8 text-xs"
              aria-label="Pilih rentang waktu"
            >
              <SelectValue placeholder="Rentang Waktu" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg text-xs">
                3 Bulan
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg text-xs">
                30 Hari
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg text-xs">
                7 Hari
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-2 sm:px-6 sm:pt-4">
        {isLoading && !trends ? (
          <div className="flex flex-col gap-2 h-[260px] justify-center items-center">
            <Skeleton className="h-[200px] w-full rounded-md" />
            <div className="flex gap-4 w-full justify-center">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-[260px] p-4 text-center">
            <Alert variant="destructive" className="max-w-md">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Gagal Memuat Tren</AlertTitle>
              <AlertDescription className="flex flex-col items-center gap-3 mt-2">
                <span>{error}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadTrends(timeRange)}
                  className="gap-2 bg-card text-foreground"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Coba Lagi
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[260px] w-full"
          >
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="fillMateri" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-materi)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-materi)"
                    stopOpacity={0.05}
                  />
                </linearGradient>
                <linearGradient id="fillTugas" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-tugas)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-tugas)"
                    stopOpacity={0.05}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.25} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={28}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  return date.toLocaleDateString("id-ID", {
                    month: "short",
                    day: "numeric",
                  })
                }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => {
                      return new Date(value).toLocaleDateString("id-ID", {
                        weekday: "short",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    }}
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="tugas"
                type="natural"
                fill="url(#fillTugas)"
                stroke="var(--color-tugas)"
                stackId="a"
              />
              <Area
                dataKey="materi"
                type="natural"
                fill="url(#fillMateri)"
                stroke="var(--color-materi)"
                stackId="a"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
