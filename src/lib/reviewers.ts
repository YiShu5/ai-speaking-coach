import type { CoachId } from "@/types";

// 分项教练展示信息（仅用于首页/练习页渲染评审席头像）
// 注意：评分权重的唯一来源是 src/app/api/report/generate/route.ts 的 COACH_WEIGHTS，
// 此处不重复维护分数，避免两处不一致
export interface CoachInfo {
  id: CoachId;
  name: string;
  role: string;
  avatarChar: string;
}

// 6 个分项教练（7-agent 架构：1 总评 + 6 分项教练）
export const COACHES: CoachInfo[] = [
  { id: "logic", name: "逻辑教练", role: "逻辑结构", avatarChar: "逻" },
  { id: "keypoint", name: "重点教练", role: "重点表达", avatarChar: "重" },
  { id: "expression", name: "表达教练", role: "表达流畅", avatarChar: "表" },
  { id: "scene", name: "场景教练", role: "场景完成度", avatarChar: "景" },
  { id: "audience", name: "听众代表", role: "听众理解度", avatarChar: "听" },
  { id: "optimizer", name: "优化教练", role: "整体成稿度", avatarChar: "优" },
];

// 兼容导出：练习页 / 首页仍在使用 REVIEWERS 渲染评审席
export const REVIEWERS = COACHES;
