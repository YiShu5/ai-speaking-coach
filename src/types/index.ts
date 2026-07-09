// SpeakCoach 全局类型定义

// 训练模式
export type PracticeMode = "5min" | "10min";

// 6 个分项教练 ID
export type CoachId =
  | "logic"
  | "keypoint"
  | "expression"
  | "scene"
  | "audience"
  | "optimizer";

// 逐句修订
export interface Revision {
  original: string;
  optimized: string;
  reason: string;
}

// 总评 agent
export interface OverallAssessment {
  summary: string;
  highlights: string[];
  improvements: string[];
  direction: string;
}

// 分项教练报告
export interface CoachReport {
  id: CoachId;
  name: string;
  role: string;
  avatarChar: string;
  score: number;
  maxScore: number;
  summary: string;
  revisions: Revision[];
  optimizedScript?: string;
  nextTask?: string;
}

// 评分标准版本：前 3 次鼓励性校准，之后严格锚点。两套标准的分数不可直接比较
export type RubricVersion = "gentle" | "strict";

// 完整报告
export interface PracticeReport {
  id: string;
  practiceId: string;
  totalScore: number;
  percentile: number | null; // 超过自己 X% 的同标准历史练习，无同标准基准时为 null（不展示）
  rubric: RubricVersion;
  isFallback?: boolean; // 示例报告（未配置 key 或 AI 调用失败），分数不入历史
  overall: OverallAssessment;
  coaches: CoachReport[];
  createdAt: string;
}

// 练习记录（列表/历史用）
export interface PracticeRecord {
  id: string;
  mode: PracticeMode;
  fileName: string;
  transcript: string;
  durationS: number;
  pauseCount: number;
  status: "active" | "completed";
  favorite: boolean;
  totalScore?: number;
  rubric?: RubricVersion; // 该分数是在哪套评分标准下打的（旧记录无此字段，视为 gentle）
  comment?: string; // 教练总评摘要
  createdAt: string;
}

// 趋势数据点
export interface TrendPoint {
  date: string; // ISO 日期
  label: string; // 显示标签：周一 / 7/1
  avgScore: number;
}

// 用户
export interface AppUser {
  id: string;
  phone: string;
  displayName: string;
}

// 练习页状态
export type PracticeStatus = "idle" | "live" | "paused";

// 转写句
export interface TranscriptLine {
  id: number;
  text: string;
  ts: number; // 时间戳
}
