// 数据层：认证调用服务端 API，练习记录/趋势用 localStorage 持久化
// 报告生成调用 /api/report/generate（DeepSeek）

import type {
  PracticeMode,
  PracticeRecord,
  PracticeReport,
  TrendPoint,
  AppUser,
} from "@/types";
import { genId } from "./utils";

const LS_USER = "speakcoach_user";
const LS_RECORDS = "speakcoach_records";
const LS_REPORTS = "speakcoach_reports";

// ---------- 用户认证（调用服务端 API） ----------

export async function sendOtp(
  phone: string
): Promise<{ success: boolean; error?: string; devCode?: string }> {
  try {
    const res = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error ?? "发送失败" };
    }
    return { success: true, devCode: data.devCode };
  } catch {
    return { success: false, error: "网络错误，请重试" };
  }
}

export async function verifyOtp(
  phone: string,
  token: string
): Promise<{ user?: AppUser; error?: string }> {
  try {
    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code: token }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { error: data.error ?? "验证失败" };
    }
    const user = data.user as AppUser;
    if (typeof window !== "undefined") {
      localStorage.setItem(LS_USER, JSON.stringify(user));
    }
    return { user };
  } catch {
    return { error: "网络错误，请重试" };
  }
}

export function getCurrentUser(): AppUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(LS_USER);
  return raw ? (JSON.parse(raw) as AppUser) : null;
}

export function logout(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(LS_USER);
  }
}

// ---------- 练习记录 ----------

function loadRecords(): PracticeRecord[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(LS_RECORDS);
  return raw ? (JSON.parse(raw) as PracticeRecord[]) : [];
}

function saveRecords(records: PracticeRecord[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(LS_RECORDS, JSON.stringify(records));
  }
}

function loadReports(): Record<string, PracticeReport> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(LS_REPORTS);
  return raw ? (JSON.parse(raw) as Record<string, PracticeReport>) : {};
}

function saveReports(reports: Record<string, PracticeReport>): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(LS_REPORTS, JSON.stringify(reports));
  }
}

export async function createPractice(
  mode: PracticeMode,
  fileName: string,
  fileContent: string
): Promise<{ id: string }> {
  const id = genId();
  const record: PracticeRecord = {
    id,
    mode,
    fileName,
    transcript: "",
    durationS: 0,
    pauseCount: 0,
    status: "active",
    favorite: false,
    createdAt: new Date().toISOString(),
  };
  const records = loadRecords();
  records.unshift(record);
  saveRecords(records);
  // 存文稿内容供报告生成用（不入 PracticeRecord 类型，单独存）
  if (typeof window !== "undefined") {
    localStorage.setItem(`speakcoach_file_${id}`, fileContent);
  }
  return { id };
}

export async function finishPractice(
  id: string,
  transcript: string,
  durationS: number,
  pauseCount: number
): Promise<void> {
  const records = loadRecords();
  const idx = records.findIndex((r) => r.id === id);
  if (idx >= 0) {
    records[idx] = {
      ...records[idx],
      transcript,
      durationS,
      pauseCount,
      status: "completed",
    };
    saveRecords(records);
  }
}

export async function toggleFavorite(id: string): Promise<boolean> {
  const records = loadRecords();
  const idx = records.findIndex((r) => r.id === id);
  if (idx >= 0) {
    records[idx].favorite = !records[idx].favorite;
    saveRecords(records);
    return records[idx].favorite;
  }
  return false;
}

// ---------- 报告生成（调用 DeepSeek API） ----------

export async function generateReport(practiceId: string): Promise<PracticeReport> {
  const records = loadRecords();
  const record = records.find((r) => r.id === practiceId);
  const fileName = record?.fileName ?? "未命名文稿";
  const transcript = record?.transcript ?? "";

  // 读取文稿内容
  let fileContent = "";
  if (typeof window !== "undefined") {
    fileContent = localStorage.getItem(`speakcoach_file_${practiceId}`) ?? "";
  }

  // 调用服务端 API（DeepSeek）
  try {
    const res = await fetch("/api/report/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ practiceId, transcript, fileName, fileContent }),
    });
    const data = await res.json();

    // 如果返回了 fallback 标记，仍然使用数据但不报错
    // 映射 7-agent 架构字段（overall + coaches）
    const report: PracticeReport = {
      id: data.id ?? genId(),
      practiceId,
      totalScore: data.totalScore,
      percentile: data.percentile,
      overall: data.overall,
      coaches: data.coaches,
      createdAt: data.createdAt ?? new Date().toISOString(),
    };

    // 保存报告到 localStorage
    const reports = loadReports();
    reports[practiceId] = report;
    saveReports(reports);

    // 回写记录的分数与评语
    if (record) {
      record.totalScore = report.totalScore;
      record.comment = report.overall.summary.slice(0, 60);
      saveRecords(records);
    }

    return report;
  } catch (err) {
    // 网络错误也用 fallback 报告兜底
    console.error("generateReport error:", err);
    throw new Error("报告生成失败，请重试");
  }
}

export function getReport(practiceId: string): PracticeReport | null {
  const reports = loadReports();
  return reports[practiceId] ?? null;
}

// ---------- 记录页数据 ----------

export function getRecords(): PracticeRecord[] {
  return loadRecords().filter((r) => r.status === "completed");
}

export function getTrend(range: "week" | "month"): TrendPoint[] {
  const records = getRecords();
  const now = new Date();
  const days = range === "week" ? 7 : 30;
  const points: TrendPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().slice(0, 10);
    const dayRecords = records.filter((r) => r.createdAt.slice(0, 10) === dayStr);
    const avg =
      dayRecords.length > 0
        ? Math.round(
            dayRecords.reduce((s, r) => s + (r.totalScore ?? 0), 0) / dayRecords.length
          )
        : 0;
    const label =
      range === "week"
        ? ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()]
        : `${d.getMonth() + 1}/${d.getDate()}`;
    if (avg > 0 || range === "week") {
      points.push({ date: dayStr, label, avgScore: avg });
    }
  }
  return points;
}
