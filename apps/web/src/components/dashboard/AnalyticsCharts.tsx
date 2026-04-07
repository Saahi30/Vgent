"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "@/lib/api";
import { TrendingUp, Clock, CheckCircle, DollarSign } from "lucide-react";

interface DailyData {
  date: string;
  total: number;
  completed: number;
  failed: number;
  avg_duration: number;
  success_rate: number;
  cost: number;
}

interface Totals {
  total_calls: number;
  completed: number;
  avg_duration: number;
  success_rate: number;
  total_cost: number;
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const chartTooltipStyle = {
  contentStyle: {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "0px",
    fontSize: "12px",
    color: "hsl(var(--foreground))",
  },
  labelStyle: { color: "hsl(var(--muted-foreground))" },
};

function ChartCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-layer-01 border border-border">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-heading-03">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function AnalyticsCharts() {
  const [daily, setDaily] = useState<DailyData[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.calls
      .analytics(30)
      .then((res) => {
        if (res.data) {
          setDaily(res.data.daily || []);
          setTotals(res.data.totals || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-border">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-layer-01 h-64 animate-pulse" />
        ))}
      </div>
    );
  }

  if (daily.length === 0) {
    return (
      <div className="bg-layer-01 border border-border px-4 py-12 text-center text-muted-foreground text-body-long-01">
        No call data yet. Analytics will appear here once calls are made.
      </div>
    );
  }

  const axisStyle = {
    fontSize: 11,
    fill: "hsl(var(--muted-foreground))",
    fontFamily: "var(--font-mono)",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-border border border-border">
      {/* Calls per Day */}
      <ChartCard title="Calls / Day" icon={TrendingUp}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={daily}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={axisStyle} />
            <YAxis tick={axisStyle} allowDecimals={false} />
            <Tooltip
              {...chartTooltipStyle}
              formatter={(value: number, name: string) => [
                value,
                name === "completed" ? "Completed" : "Failed",
              ]}
              labelFormatter={formatDate}
            />
            <Bar
              dataKey="completed"
              stackId="calls"
              fill="hsl(var(--success))"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="failed"
              stackId="calls"
              fill="hsl(var(--destructive))"
              radius={[0, 0, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Avg Duration */}
      <ChartCard title="Avg Duration (sec)" icon={Clock}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={daily}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={axisStyle} />
            <YAxis tick={axisStyle} />
            <Tooltip
              {...chartTooltipStyle}
              formatter={(value: number) => [`${value}s`, "Avg Duration"]}
              labelFormatter={formatDate}
            />
            <Line
              type="monotone"
              dataKey="avg_duration"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Success Rate */}
      <ChartCard title="Success Rate (%)" icon={CheckCircle}>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={daily}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={axisStyle} />
            <YAxis tick={axisStyle} domain={[0, 100]} />
            <Tooltip
              {...chartTooltipStyle}
              formatter={(value: number) => [`${value}%`, "Success Rate"]}
              labelFormatter={formatDate}
            />
            <defs>
              <linearGradient id="successGrad" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="hsl(var(--success))"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="hsl(var(--success))"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="success_rate"
              stroke="hsl(var(--success))"
              strokeWidth={2}
              fill="url(#successGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "hsl(var(--success))" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Cost Trend */}
      <ChartCard title="Cost Trend (USD)" icon={DollarSign}>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={daily}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={axisStyle} />
            <YAxis tick={axisStyle} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              {...chartTooltipStyle}
              formatter={(value: number) => [
                `$${value.toFixed(4)}`,
                "Cost",
              ]}
              labelFormatter={formatDate}
            />
            <defs>
              <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="hsl(var(--warning))"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="hsl(var(--warning))"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="cost"
              stroke="hsl(var(--warning))"
              strokeWidth={2}
              fill="url(#costGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "hsl(var(--warning))" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
