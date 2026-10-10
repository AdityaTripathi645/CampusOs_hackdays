"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts";

const PALETTE = ["#5b45e6", "#a78bfa", "#10b981", "#f59e0b"];

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e6e8f1",
  boxShadow: "0 12px 40px -12px rgb(17 26 61 / 0.25)",
  fontSize: 12,
};

export function GroupedBarChart({
  data,
  keys,
  labels,
  xKey,
  height = 260,
}: {
  data: Record<string, string | number>[];
  keys: string[];
  labels?: string[];
  xKey: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={4}>
        <CartesianGrid vertical={false} stroke="#eceef5" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={{ fill: "#6a7397", fontSize: 12 }} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#6a7397", fontSize: 12 }} />
        <Tooltip cursor={{ fill: "#f6f7fb" }} contentStyle={tooltipStyle} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        {keys.map((k, i) => (
          <Bar key={k} dataKey={k} name={labels?.[i] ?? k} fill={PALETTE[i % PALETTE.length]} radius={[6, 6, 0, 0]} maxBarSize={28} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendArea({
  data,
  xKey,
  yKey,
  height = 200,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  yKey: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="co-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6d5cf6" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#6d5cf6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#eceef5" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={{ fill: "#6a7397", fontSize: 12 }} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#6a7397", fontSize: 12 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey={yKey} stroke="#5b45e6" strokeWidth={2} fill="url(#co-area)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ScoreSpreadChart({
  data,
  height = 220,
}: {
  data: { name: string; [judge: string]: string | number }[];
  height?: number;
}) {
  const keys = data.length ? Object.keys(data[0]!).filter((k) => k !== "name") : [];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke="#eceef5" />
        <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: "#6a7397", fontSize: 11 }} />
        <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} tick={{ fill: "#333e6b", fontSize: 12 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        {keys.map((k, i) => (
          <Bar key={k} dataKey={k} fill={PALETTE[i % PALETTE.length]} radius={[0, 6, 6, 0]} maxBarSize={14} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
