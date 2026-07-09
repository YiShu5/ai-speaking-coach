"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  ChevronUp,
  ChevronDown,
  Loader2,
  RotateCcw,
  AlertCircle,
  Check,
  AlertTriangle,
  Compass,
  Sparkles,
} from "lucide-react";
import { generateReport, getReport, toggleFavorite } from "@/lib/mock-api";
import { useAppStore } from "@/stores/app-store";
import { Avatar } from "@/components/ui/Avatar";
import type { PracticeReport, CoachReport } from "@/types";

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const showToast = useAppStore((s) => s.showToast);
  const practiceId = params.id;

  const [report, setReport] = useState<PracticeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [openId, setOpenId] = useState<string | null>("logic");

  async function load(gen = false) {
    setLoading(true);
    setError(false);
    try {
      let r = gen ? null : getReport(practiceId);
      if (!r) {
        r = await generateReport(practiceId);
      }
      setReport(r);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // 优先使用已缓存的报告，避免从历史进入时覆盖第一次的评价
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceId]);

  async function handleFavorite() {
    const next = !favorite;
    setFavorite(next);
    showToast(next ? "已收藏" : "已取消收藏");
    await toggleFavorite(practiceId);
  }

  if (loading) return <ReportSkeleton />;

  if (error || !report) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertCircle size={40} className="mx-auto mb-4 text-[var(--muted)]" />
          <p className="mb-4 text-[var(--muted)]">报告生成失败了，重试一下</p>
          <button
            onClick={() => load(true)}
            className="rounded-full px-6 py-3 text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, var(--blue), var(--lavender))" }}
          >
            重新生成
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="scroll-soft h-full overflow-y-auto">
      <div className="mx-auto max-w-[980px] px-10 py-10">
        {/* 顶部栏 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-start justify-between"
        >
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--blue-deep)]">
              Review report
            </div>
            <h1 className="text-3xl font-black text-[var(--ink)]">本次练习评价</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              7 位 AI 教练协同评审：1 位总评 + 6 位分项教练逐项拆解。
            </p>
          </div>
          <motion.button
            onClick={handleFavorite}
            whileTap={{ scale: 0.85 }}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--paper-solid)] transition-colors"
            style={{ border: "1px solid var(--line)", boxShadow: "var(--soft-shadow)" }}
            aria-pressed={favorite}
            aria-label="收藏"
          >
            <Heart
              size={22}
              fill={favorite ? "var(--blue-deep)" : "none"}
              color={favorite ? "var(--blue-deep)" : "var(--muted)"}
            />
          </motion.button>
        </motion.div>

        {/* 示例报告提示：AI 评审失败时的兜底数据，分数不入历史 */}
        {report.isFallback && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-start gap-3 rounded-2xl px-5 py-4"
            style={{ background: "var(--lavender-soft)", border: "1px solid var(--line)" }}
          >
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[var(--blue-deep)]" />
            <div className="text-sm leading-relaxed text-[var(--ink)]">
              <span className="font-bold">这是一份示例报告。</span>
              AI 评审未成功（未配置 API Key 或调用失败），以下分数为演示数据，不会计入你的历史成绩与趋势。
              <button
                onClick={() => load(true)}
                className="ml-1 font-bold text-[var(--blue-deep)] underline underline-offset-2"
              >
                重新生成
              </button>
            </div>
          </motion.div>
        )}

        {/* 综合分概览：左侧总分 + 右侧 6 教练小卡 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 grid gap-5"
          style={{ gridTemplateColumns: "210px 1fr" }}
        >
          {/* 总分卡 */}
          <div
            className="relative flex flex-col items-center justify-center overflow-hidden rounded-[28px] py-8 text-white"
            style={{
              background: "linear-gradient(135deg, var(--blue), var(--lavender))",
              boxShadow: "var(--score-shadow)",
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10"
            />
            <div className="relative text-xs font-bold uppercase tracking-wider text-white/80">
              综合分
            </div>
            <AnimatedScore value={report.totalScore} />
            <div className="relative text-xs text-white/80">满分 100</div>
            {report.rubric && (
              <div className="relative mt-1 text-[11px] text-white/70">
                {report.rubric === "strict" ? "严格评分标准" : "鼓励性评分（前 3 次练习）"}
              </div>
            )}
            {report.percentile != null ? (
              <div className="relative mt-1 text-xs text-white/80">
                超过你 {report.percentile}% 的历史练习
              </div>
            ) : report.rubric === "strict" && !report.isFallback ? (
              <div className="relative mt-1 text-[11px] text-white/70">
                评分标准已切换，历史对比重新累计
              </div>
            ) : null}
          </div>

          {/* 6 教练小卡：3 列 × 2 行 */}
          <div className="grid grid-cols-3 gap-3">
            {report.coaches.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.08 }}
                className="flex flex-col items-center rounded-3xl bg-[var(--paper-solid)] p-4 text-center"
                style={{ border: "1px solid var(--line)", boxShadow: "var(--soft-shadow)" }}
              >
                <Avatar char={c.avatarChar} size={40} />
                <div className="mt-2 text-sm font-bold text-[var(--ink)]">{c.name}</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span
                    className="font-black tabular-nums text-[var(--blue-deep)]"
                    style={{ fontSize: 26 }}
                  >
                    {c.score}
                  </span>
                  <span className="text-xs font-bold text-[var(--quiet)]">/{c.maxScore}</span>
                </div>
                <div className="mt-0.5 text-[11px] leading-tight text-[var(--muted)]">{c.role}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* 总评卡（overall） */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-6 rounded-[28px] bg-[var(--paper-solid)] p-6"
          style={{ border: "1px solid var(--line)", boxShadow: "var(--soft-shadow)" }}
        >
          <div className="mb-3 flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-white"
              style={{ background: "linear-gradient(135deg, var(--blue), var(--lavender))" }}
            >
              <Compass size={20} />
            </div>
            <h2 className="text-lg font-extrabold text-[var(--ink)]">总评审官</h2>
          </div>
          <p className="mb-4 text-[14px] leading-relaxed text-[var(--ink)]">
            {report.overall.summary}
          </p>

          {/* 亮点 */}
          {report.overall.highlights.length > 0 && (
            <div className="mb-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[var(--blue-deep)]">
                <Check size={14} />
                亮点
              </div>
              <ul className="flex flex-col gap-1.5">
                {report.overall.highlights.map((h, i) => (
                  <li
                    key={i}
                    className="flex gap-2 rounded-xl bg-[var(--soft-blue)] px-3 py-2 text-[13px] leading-relaxed text-[var(--ink)]"
                  >
                    <Check size={14} className="mt-0.5 shrink-0 text-[var(--blue-deep)]" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 改进点 */}
          {report.overall.improvements.length > 0 && (
            <div className="mb-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[#d97706]">
                <AlertTriangle size={14} />
                改进点
              </div>
              <ul className="flex flex-col gap-1.5">
                {report.overall.improvements.map((im, i) => (
                  <li
                    key={i}
                    className="flex gap-2 rounded-xl bg-[#fff7ed] px-3 py-2 text-[13px] leading-relaxed text-[var(--ink)]"
                  >
                    <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[#d97706]" />
                    <span>{im}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 优化方向 */}
          <div className="flex items-start gap-2 rounded-xl bg-[var(--lavender-soft)] px-3 py-2.5">
            <Compass size={14} className="mt-0.5 shrink-0 text-[var(--blue-deep)]" />
            <p className="text-[13px] leading-relaxed text-[var(--blue-deep)]">
              <span className="font-extrabold">下一步方向：</span>
              {report.overall.direction}
            </p>
          </div>
        </motion.div>

        {/* 6 个分项教练报告列表 */}
        <div className="flex flex-col gap-4">
          {report.coaches.map((c, i) => (
            <CoachCard
              key={c.id}
              coach={c}
              index={i}
              open={openId === c.id}
              onToggle={() => setOpenId(openId === c.id ? null : c.id)}
            />
          ))}
        </div>

        {/* 再练一次 */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 rounded-full bg-[var(--paper-solid)] px-6 py-3 text-sm font-bold text-[var(--blue-deep)] transition-colors hover:bg-[var(--soft-blue)]"
            style={{ border: "1px solid var(--line)" }}
          >
            <RotateCcw size={16} />
            再练一次
          </button>
        </div>
      </div>
    </div>
  );
}

// 单个教练卡片（可折叠）
function CoachCard({
  coach,
  index,
  open,
  onToggle,
}: {
  coach: CoachReport;
  index: number;
  open: boolean;
  onToggle: () => void;
}) {
  const isOptimizer = coach.id === "optimizer";
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 + index * 0.08 }}
      className="overflow-hidden rounded-[28px] bg-[var(--paper-solid)]"
      style={{ border: "1px solid var(--line)", boxShadow: "var(--soft-shadow)" }}
    >
      {/* 折叠头 */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 p-5 text-left"
      >
        <Avatar char={coach.avatarChar} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-extrabold text-[var(--ink)]">{coach.name}</span>
            <span className="text-xs text-[var(--muted)]">· {coach.role}</span>
          </div>
          <p className="mt-0.5 truncate text-sm text-[var(--muted)]">{coach.summary}</p>
        </div>
        <div className="flex items-baseline gap-0.5">
          <span
            className="font-black tabular-nums text-[var(--blue-deep)]"
            style={{ fontSize: 26 }}
          >
            {coach.score}
          </span>
          <span className="text-xs font-bold text-[var(--quiet)]">/{coach.maxScore}</span>
        </div>
        <div className="text-[var(--muted)]">
          {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </button>

      {/* 报告正文 */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 px-5 pb-5">
              {/* 逐句修订 */}
              {coach.revisions.map((rev, ri) => (
                <motion.div
                  key={ri}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: ri * 0.1 }}
                  className="rounded-[22px] bg-[var(--soft)] p-4"
                >
                  <RevisionLine label="原文" text={rev.original} />
                  <RevisionLine label="优化" text={rev.optimized} bold />
                  <RevisionLine label="原因" text={rev.reason} muted />
                </motion.div>
              ))}

              {/* 优化教练额外内容：优化稿 + 下一次练习任务 */}
              {isOptimizer && coach.optimizedScript && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-[22px] p-4"
                  style={{
                    background: "linear-gradient(135deg, var(--soft-blue), var(--lavender-soft))",
                    border: "1px solid var(--line)",
                  }}
                >
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-[var(--blue-deep)]">
                    <Sparkles size={14} />
                    优化稿（可直接开口说）
                  </div>
                  <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--ink)]">
                    {coach.optimizedScript}
                  </p>
                </motion.div>
              )}

              {isOptimizer && coach.nextTask && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="flex items-start gap-2 rounded-[22px] bg-[var(--lavender-soft)] px-4 py-3"
                >
                  <Compass size={16} className="mt-0.5 shrink-0 text-[var(--blue-deep)]" />
                  <div>
                    <div className="text-xs font-extrabold text-[var(--blue-deep)]">下一次练习任务</div>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--ink)]">
                      {coach.nextTask}
                    </p>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function RevisionLine({
  label,
  text,
  bold,
  muted,
}: {
  label: string;
  text: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="mb-2 flex gap-3 last:mb-0">
      <span
        className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
        style={{
          background: muted ? "var(--lavender-soft)" : "var(--soft-blue)",
          color: "var(--blue-deep)",
        }}
      >
        {label}
      </span>
      <p
        className={`text-[14px] leading-relaxed ${
          bold ? "font-bold text-[var(--ink)]" : "text-[var(--ink)]"
        }`}
      >
        {text}
      </p>
    </div>
  );
}

// 数字滚动动画
function AnimatedScore({ value, small }: { value: number; small?: boolean }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const duration = 1200;
    const from = 0;
    const to = value;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);
  return (
    <span
      className="font-black tabular-nums"
      style={{ fontSize: small ? 28 : 60, lineHeight: 1 }}
    >
      {display}
    </span>
  );
}

function ReportSkeleton() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <Loader2 size={40} className="animate-spin text-[var(--blue-deep)]" />
      <p className="text-lg font-bold text-[var(--ink)]">AI 评审正在生成，约需 1 分钟…</p>
      <div className="mt-6 w-full max-w-[600px] space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
            className="h-16 rounded-2xl bg-[var(--soft)]"
          />
        ))}
      </div>
    </div>
  );
}
