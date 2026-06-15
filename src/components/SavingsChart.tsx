"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney, formatMonthLabel } from "@/lib/format";

export type ChartPoint = { ym: string; cumulative: number };

export function SavingsChart({
  data,
  targetAmount,
  currency,
}: {
  data: ChartPoint[];
  targetAmount: number;
  currency: string;
}) {
  const chartData = data.map((d) => ({
    label: formatMonthLabel(d.ym),
    cumulative: Math.round(d.cumulative),
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D8A24A" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#D8A24A" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1B2A4A11" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#6B7280" }}
            tickLine={false}
            axisLine={{ stroke: "#1B2A4A22" }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#6B7280" }}
            tickLine={false}
            axisLine={false}
            width={70}
            tickFormatter={(v: number) => formatMoney(v, currency)}
          />
          <Tooltip
            formatter={(v: number) => [formatMoney(v, currency), "เงินสะสม"]}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #1B2A4A22",
              fontSize: 12,
            }}
          />
          <ReferenceLine
            y={targetAmount}
            stroke="#2F8F83"
            strokeDasharray="4 4"
            label={{
              value: `เป้า ${formatMoney(targetAmount, currency)}`,
              fontSize: 11,
              fill: "#2F8F83",
              position: "insideTopRight",
            }}
          />
          <Area
            type="monotone"
            dataKey="cumulative"
            stroke="#D8A24A"
            strokeWidth={2}
            fill="url(#gold)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
