import type { CoachId } from "@/types";

// 分项教练信息
export interface CoachInfo {
  id: CoachId;
  name: string;
  role: string;
  avatarChar: string;
  maxScore: number;
}

// 6 个分项教练（7-agent 架构：1 总评 + 6 分项教练），每位教练打 0-100 分
export const COACHES: CoachInfo[] = [
  { id: "logic", name: "逻辑教练", role: "逻辑结构", avatarChar: "逻", maxScore: 100 },
  { id: "keypoint", name: "重点教练", role: "重点表达", avatarChar: "重", maxScore: 100 },
  { id: "expression", name: "表达教练", role: "表达流畅", avatarChar: "表", maxScore: 100 },
  { id: "scene", name: "场景教练", role: "场景完成度", avatarChar: "景", maxScore: 100 },
  { id: "audience", name: "听众代表", role: "听众理解度", avatarChar: "听", maxScore: 100 },
  { id: "optimizer", name: "优化教练", role: "整体成稿度", avatarChar: "优", maxScore: 100 },
];

// 教练权重（百分比，合计 100）：总分 = Σ(教练分 × 权重) / 100，改权重只需改这里
export const COACH_WEIGHTS: Record<CoachId, number> = {
  logic: 30,
  keypoint: 25,
  optimizer: 15,
  expression: 12,
  scene: 10,
  audience: 8,
};

// 计算综合分（6 个教练 0-100 分按权重加权平均，满分 100）
export function calcTotalScore(scores: Record<CoachId, number>): number {
  return Math.round(
    Object.entries(scores).reduce(
      (sum, [id, score]) => sum + score * (COACH_WEIGHTS[id as CoachId] ?? 0),
      0
    ) / 100
  );
}

// 兼容导出：练习页 / 首页仍在使用 REVIEWERS 渲染评审席
export const REVIEWERS = COACHES;
