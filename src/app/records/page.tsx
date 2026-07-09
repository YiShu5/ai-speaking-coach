"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, ChevronRight, TrendingUp } from "lucide-react";
import { getRecords, getTrend } from "@/lib/mock-api";
import { weekdayOf, clamp } from "@/lib/utils";
import { useRequireAuth } from "@/lib/use-require-auth";
import type { PracticeRecord, TrendPoint } from "@/types";

type Range = "week" | "month";
type SortBy = "time" | "score";
type SortDir = "asc" | "desc";

export default function RecordsPage() {
  useRequireAuth();
  const router = useRouter();
  const [range, setRange] = useState<Range>("week");
  const [sortBy, setSortBy] = useState<SortBy>("time");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  // 避免 SSR/CSR hydration 不匹配：localStorage 只在客户端可用
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const trend = useMemo<TrendPoint[]>(() => (mounted ? getTrend(range) : []), [range, mounted]);
  const records = useMemo<PracticeRecord[]>(() => {
    if (!mounted) return [];
    let list = getRecords();
    list = [...list].sort((a, b) => {
      let cmp: number;
      if (sortBy === "time") {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else {
        cmp = (a.totalScore ?? 0) - (b.totalScore ?? 0);
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return list;
  }, [sortBy, sortDir, mounted]);

  return (
    <div className="scroll-soft h-full overflow-y-auto">
      <div className="mx-auto max-w-[1000px] px-10 py-12">
        {/* 顶部栏 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-start justify-between"
        >
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--blue-deep)]">
              Practice archive
            </div>
            <h1 className="text-3xl font-black text-[var(--ink)]">训练记录</h1>
          </div>
          <div
            className="flex rounded-full p-1"
            style={{ background: "var(--soft)" }}
          >
            {(["week", "month"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => {
                  setRange(r);
                  setSelectedPoint(null);
                }}
                className="relative rounded-full px-5 py-2 text-sm font-bold transition-colors"
                style={{
                  background: range === r ? "linear-gradient(135deg, var(--blue), var(--lavender))" : "transparent",
                  color: range === r ? "#fff" : "var(--muted)",
                }}
              >
                {r === "week" ? "周" : "月"}
              </button>
            ))}
          </div>
        </motion.div>

        {!mounted ? (
          <RecordsSkeleton />
        ) : records.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* 趋势卡 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-8 rounded-[28px] bg-[var(--paper-solid)] p-6"
              style={{ border: "1px solid var(--line)", boxShadow: "var(--shadow)" }}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp size={18} className="text-[var(--blue-deep)]" />
                  <h2 className="text-lg font-extrabold text-[var(--ink)]">平均分趋势</h2>
                </div>
                <span className="text-xs text-[var(--muted)]">
                  {range === "week" ? "按周查看" : "按月查看"}
                </span>
              </div>
              <TrendChart
                points={trend}
                selected={selectedPoint}
                onSelect={setSelectedPoint}
              />
            </motion.div>

            {/* 历史训练 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-[var(--ink)]">历史训练</h2>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-full p-1" style={{ background: "var(--soft)" }}>
                    {(["time", "score"] as SortBy[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSortBy(s)}
                        className="rounded-full px-4 py-1.5 text-xs font-bold transition-colors"
                        style={{
                          background: sortBy === s ? "var(--paper-solid)" : "transparent",
                          color: sortBy === s ? "var(--blue-deep)" : "var(--muted)",
                          boxShadow: sortBy === s ? "var(--soft-shadow)" : "none",
                        }}
                      >
                        {s === "time" ? "按时间" : "按分数"}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--soft)] text-[var(--blue-deep)] transition-colors hover:bg-[var(--soft-blue)]"
                  >
                    {sortDir === "desc" ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {records.map((r, i) => (
                  <motion.button
                    key={r.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ x: 4 }}
                    onClick={() => router.push(`/report/${r.id}`)}
                    className="flex items-center gap-4 rounded-[22px] bg-[var(--paper-solid)] p-4 text-left"
                    style={{ border: "1px solid var(--line)", boxShadow: "var(--soft-shadow)" }}
                  >
                    {/* 分数圆 */}
                    <div
                      className="flex h-[78px] w-[78px] shrink-0 items-center justify-center rounded-full font-black text-white"
                      style={{
                        background: "linear-gradient(135deg, var(--blue), var(--lavender))",
                        fontSize: 26,
                      }}
                    >
                      {r.totalScore ?? "--"}
                    </div>
                    {/* 内容 */}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[15px] font-extrabold text-[var(--ink)]">
                        {r.fileName.replace(/\.[^.]+$/, "")} ·{" "}
                        {r.mode === "5min" ? "5分钟快速汇报" : "10分钟演讲"} · {weekdayOf(r.createdAt)}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--muted)]">
                        {r.comment ?? "暂无评语"}
                      </p>
                    </div>
                    {/* 箭头 */}
                    <div
                      className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-white"
                      style={{
                        background: "linear-gradient(135deg, var(--blue), var(--lavender))",
                      }}
                    >
                      <ChevronRight size={20} />
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}

// SVG 趋势图
function TrendChart({
  points,
  selected,
  onSelect,
}: {
  points: TrendPoint[];
  selected: number | null;
  onSelect: (i: number | null) => void;
}) {
  const W = 900;
  const H = 240;
  const PAD = { top: 30, right: 30, bottom: 36, left: 44 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const valid = points.filter((p) => p.avgScore > 0);
  if (valid.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-[var(--quiet)]">
        还没有练习数据，去完成第一次练习吧
      </div>
    );
  }

  const scores = valid.map((p) => p.avgScore);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const yMin = clamp(min - 5, 0, 95);
  const yMax = clamp(max + 5, 70, 100);
  const yRange = yMax - yMin || 1;

  const xStep = valid.length > 1 ? innerW / (valid.length - 1) : 0;
  const x = (i: number) => PAD.left + i * xStep;
  const y = (v: number) => PAD.top + innerH - ((v - yMin) / yRange) * innerH;

  const pathD = valid
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.avgScore)}`)
    .join(" ");

  const yTicks = Array.from({ length: 5 }, (_, i) => yMin + (yRange / 4) * i);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 280 }}>
      {/* Y 轴刻度 */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={PAD.left}
            y1={y(t)}
            x2={W - PAD.right}
            y2={y(t)}
            stroke="var(--line)"
            strokeWidth={1}
          />
          <text
            x={PAD.left - 8}
            y={y(t) + 4}
            textAnchor="end"
            fontSize={11}
            fill="var(--quiet)"
          >
            {Math.round(t)}
          </text>
        </g>
      ))}

      {/* 引导虚线（选中点） */}
      {selected !== null && valid[selected] && (
        <line
          x1={x(selected)}
          y1={PAD.top}
          x2={x(selected)}
          y2={PAD.top + innerH}
          stroke="var(--blue)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          opacity={0.5}
        />
      )}

      {/* 折线 */}
      <motion.path
        d={pathD}
        fill="none"
        stroke="var(--blue-deep)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />

      {/* 数据点 */}
      {valid.map((p, i) => (
        <g key={i} onClick={() => onSelect(selected === i ? null : i)} style={{ cursor: "pointer" }}>
          <motion.circle
            cx={x(i)}
            cy={y(p.avgScore)}
            r={selected === i ? 8 : 7}
            fill="var(--blue-deep)"
            stroke="#fff"
            strokeWidth={3}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5 + i * 0.1, type: "spring" }}
            style={{ transformOrigin: `${x(i)}px ${y(p.avgScore)}px` }}
          />
          {/* 选中气泡 */}
          {selected === i && (
            <motion.g
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <rect
                x={x(i) - 26}
                y={y(p.avgScore) - 36}
                width={52}
                height={26}
                rx={13}
                fill="url(#scoreGrad)"
              />
              <text
                x={x(i)}
                y={y(p.avgScore) - 19}
                textAnchor="middle"
                fontSize={13}
                fontWeight={900}
                fill="#fff"
              >
                {p.avgScore}
              </text>
            </motion.g>
          )}
        </g>
      ))}

      {/* X 轴标签 */}
      {valid.map((p, i) => (
        <text
          key={i}
          x={x(i)}
          y={H - 12}
          textAnchor="middle"
          fontSize={11}
          fill="var(--muted)"
        >
          {p.label}
        </text>
      ))}

      <defs>
        <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--blue)" />
          <stop offset="100%" stopColor="var(--lavender)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center rounded-[28px] bg-[var(--paper-solid)] py-20 text-center"
      style={{ border: "1px solid var(--line)", boxShadow: "var(--soft-shadow)" }}
    >
      <div
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-full text-white"
        style={{ background: "linear-gradient(135deg, var(--blue), var(--lavender))" }}
      >
        <TrendingUp size={28} />
      </div>
      <p className="text-lg font-bold text-[var(--ink)]">还没有练习数据</p>
      <p className="mt-1 text-sm text-[var(--muted)]">去完成第一次练习吧</p>
    </motion.div>
  );
}

function RecordsSkeleton() {
  return (
    <div
      className="mb-8 flex items-center justify-center rounded-[28px] bg-[var(--paper-solid)] py-20"
      style={{ border: "1px solid var(--line)", boxShadow: "var(--soft-shadow)" }}
    >
      <div
        className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--line)] border-t-[var(--blue-deep)]"
      />
    </div>
  );
}
