"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney, formatMonthLabel, formatPercent } from "@/lib/format";

type PerCategory = { categoryId: string; name: string; values: number[] };

export type VariableTrendData = {
  months: string[];
  total: number[];
  perCategory: PerCategory[];
  latest: {
    ym: string;
    total: number;
    prevTotal: number;
    deltaRatio: number | null;
  } | null;
};

// jade, gold, ink, warn, muted + a couple extras for category lines
const LINE_COLORS = [
  "#2F8F83",
  "#D8A24A",
  "#1B2A4A",
  "#C0492F",
  "#6B7280",
  "#3B82A0",
  "#9B6BD8",
];

export function VariableTrendChart({
  data,
  currency,
}: {
  data: VariableTrendData;
  currency: string;
}) {
  const [breakdown, setBreakdown] = useState(false);

  const rows = data.months.map((ym, i) => {
    const row: Record<string, number | string> = {
      label: formatMonthLabel(ym),
      total: Math.round(data.total[i]),
    };
    for (const c of data.perCategory) {
      row[c.categoryId] = Math.round(c.values[i]);
    }
    return row;
  });

  const delta = data.latest?.deltaRatio ?? null;
  const deltaUp = delta != null && delta > 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {data.latest && (
            <div className="text-sm">
              <span className="text-muted">
                {formatMonthLabel(data.latest.ym)}:{" "}
              </span>
              <span className="font-semibold text-ink tabular">
                {formatMoney(data.latest.total, currency)}
              </span>
              {delta != null ? (
                <span
                  className={`ml-2 tabular ${deltaUp ? "text-warn" : "text-jade"}`}
                >
                  {deltaUp ? "▲" : "▼"} {formatPercent(Math.abs(delta))} เทียบเดือนก่อน
                </span>
              ) : (
                <span className="ml-2 text-xs text-muted">ไม่มีข้อมูลเดือนก่อน</span>
              )}
            </div>
          )}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={breakdown}
            onChange={(e) => setBreakdown(e.target.checked)}
            className="accent-gold"
          />
          แยกตามหมวด
        </label>
      </div>

      <div className="mt-4 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {breakdown ? (
            <LineChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
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
                formatter={(v: number) => formatMoney(v, currency)}
                contentStyle={{ borderRadius: 8, border: "1px solid #1B2A4A22", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {data.perCategory.map((c, i) => (
                <Line
                  key={c.categoryId}
                  type="monotone"
                  dataKey={c.categoryId}
                  name={c.name}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          ) : (
            <AreaChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="varTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C0492F" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#C0492F" stopOpacity={0} />
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
                formatter={(v: number) => [formatMoney(v, currency), "รายจ่ายผันแปร"]}
                contentStyle={{ borderRadius: 8, border: "1px solid #1B2A4A22", fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#C0492F"
                strokeWidth={2}
                fill="url(#varTrend)"
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
