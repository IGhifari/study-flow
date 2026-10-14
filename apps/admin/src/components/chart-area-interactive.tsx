"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

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

// Generate realistic platform daily activity trends over the last 90 days ending today
function generateChartData() {
  const data = []
  const now = new Date()
  for (let i = 89; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split("T")[0]
    const dayOffset = 90 - i
    const baseMateri = Math.round(
      16 + Math.sin(dayOffset / 5) * 7 + (dayOffset % 7 === 0 ? -5 : 4)
    )
    const baseTugas = Math.round(
      22 + Math.cos(dayOffset / 6) * 9 + (dayOffset % 5 === 0 ? 6 : -2)
    )
    data.push({
      date: dateStr,
      materi: Math.max(4, baseMateri),
      tugas: Math.max(6, baseTugas),
    })
  }
  return data
}

const chartData = generateChartData()

const chartConfig = {
  materi: {
    label: "Materi Kuliah",
    color: "hsl(var(--chart-1))",
  },
  tugas: {
    label: "Tugas Kuliah",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("30d")

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  const filteredData = React.useMemo(() => {
    const now = new Date()
    let daysToSubtract = 90
    if (timeRange === "30d") {
      daysToSubtract = 30
    } else if (timeRange === "7d") {
      daysToSubtract = 7
    }
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - daysToSubtract)

    return chartData.filter((item) => {
      const date = new Date(item.date)
      return date >= startDate
    })
  }, [timeRange])

  return (
    <Card className="@container/card shadow-xs">
      <CardHeader className="relative flex flex-col gap-1 pb-4">
        <CardTitle className="text-lg font-semibold tracking-tight md:text-xl">
          Tren Aktivitas Platform
        </CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">
            Volume materi perkuliahan diunggah dan pembuatan tugas akademik
          </span>
          <span className="@[540px]/card:hidden">Materi vs Tugas mahasiswa</span>
        </CardDescription>
        <div className="absolute right-4 top-4">
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={(val) => {
              if (val) setTimeRange(val)
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
              if (val) setTimeRange(val)
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
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[260px] w-full"
        >
          <AreaChart data={filteredData}>
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
      </CardContent>
    </Card>
  )
}
