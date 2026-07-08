import type { CoachId } from "@/types";

// 分项教练信息
export interface CoachInfo {
  id: CoachId;
  name: string;
  role: string;
  avatarChar: string;
  maxScore: number;
}

// 6 个分项教练（7-agent 架构：1 总评 + 6 分项教练）
export const COACHES: CoachInfo[] = [
  { id: "logic", name: "逻辑教练", role: "逻辑结构", avatarChar: "逻", maxScore: 25 },
  { id: "keypoint", name: "重点教练", role: "重点表达", avatarChar: "重", maxScore: 20 },
  { id: "expression", name: "表达教练", role: "表达流畅", avatarChar: "表", maxScore: 20 },
  { id: "scene", name: "场景教练", role: "场景完成度", avatarChar: "景", maxScore: 15 },
  { id: "audience", name: "听众代表", role: "听众理解度", avatarChar: "听", maxScore: 10 },
  { id: "optimizer", name: "优化教练", role: "优化潜力", avatarChar: "优", maxScore: 10 },
];

// 各教练满分（满分制，总分 100）
export const COACH_MAX_SCORES: Record<CoachId, number> = {
  logic: 25,
  keypoint: 20,
  expression: 20,
  scene: 15,
  audience: 10,
  optimizer: 10,
};

// 计算综合分（6 个教练分数之和，满分 100）
export function calcTotalScore(scores: Record<CoachId, number>): number {
  return Object.entries(scores).reduce(
    (sum, [_id, score]) => sum + score,
    0
  );
}

// 兼容导出：练习页 / 首页仍在使用 REVIEWERS 渲染评审席
export const REVIEWERS = COACHES;
