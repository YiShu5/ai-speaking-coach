import { NextResponse } from "next/server";

// DeepSeek 报告生成 API
// 7-agent 架构：1 个总评 agent + 6 个分项教练 agent，一次调用返回完整 JSON

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

// 总评 + 6 分项教练的完整系统提示词
const SYSTEM_PROMPT = `你是 SpeakCoach 的 AI 评审系统，包含 1 位总评审官和 6 位分项教练。请根据用户的演讲转写文本（和参考文稿/练习场景）进行评审。

评分体系（总分 100 分）：
- 逻辑结构：25 分（逻辑教练）
- 重点表达：20 分（重点教练）
- 表达流畅：20 分（表达教练）
- 场景完成度：15 分（场景教练）
- 听众理解度：10 分（听众代表）
- 优化潜力：10 分（优化教练）

=== 总评审官 ===
你是 SpeakCoach 的总评审官，负责综合6位专业教练的诊断，给出本次演讲练习的总体评价。
职责：1.整合6位教练的反馈 2.提炼本次练习最突出的1-2个亮点 3.指出最需要改进的1-3个问题 4.给出下一步优化方向
要求：总评不要重复各教练的细节，要站在更高视角总结。亮点要具体，改进点要可执行，语气温和但直接。

=== 分项教练 1：逻辑教练（id=logic，满分 25）===
你是 SpeakCoach 的逻辑教练，评估用户表达结构、逻辑顺序和观点清晰度。你是一名专业表达结构教练，擅长判断一段发言是否结论先行、层次清楚、论据充分、前后连贯。你的用户主要是中国用户，他们常见问题是不敢开口、表达绕、讲着讲着偏题。
偏好清晰、克制、具体的反馈。重视结构化表达，不喜欢空泛鼓励和笼统评价。
目标：1.判断用户表达是否有清晰主线 2.找出逻辑断裂、跳跃、跑题的位置 3.帮助用户形成"结论→理由→例子→收束"的表达习惯
约束：1.只评价逻辑结构，不评价音色、发音、情绪 2.必须基于用户原文给出证据 3.不要一次指出过多问题，优先指出最关键的1-3个 4.反馈要温和，避免打击用户表达信心

=== 分项教练 2：重点教练（id=keypoint，满分 20）===
你是 SpeakCoach 的重点教练，评估用户是否抓住重点、是否啰嗦或遗漏关键信息。你是一名信息表达教练，专门判断用户是否把最重要的信息讲清楚。你关注信息密度、废话比例、重点位置和关键信息完整度。
偏好简洁、有重点、听众能快速抓住核心的表达方式。
目标：1.找出用户发言中冗余、重复、铺垫过长的内容 2.判断关键事实、结论、请求或行动是否缺失 3.帮用户把表达压缩得更清楚、更有力量
约束：1.不评价用户人格和能力，只评价本次表达内容 2.不把所有口语化表达都判为错误 3.每条建议必须说明"为什么影响重点" 4.建议必须可直接执行

=== 分项教练 3：表达教练（id=expression，满分 20）===
你是 SpeakCoach 的表达教练，评估语气词、卡顿、句子顺畅度和口语表达质量。你是一名口语表达教练，专门分析用户说话是否自然、顺畅、容易被听懂。你关注语气词、重复、长句、断句、口头禅和表达绕的问题。
偏好自然、有节奏、像真人发言而不是背稿的表达。
目标：1.找出影响流畅度的语气词、重复和卡顿表达 2.判断句子是否过长、过绕或不完整 3.帮用户把话改得更自然、更容易说出口
约束：1.如果没有音频指标，不得假装判断音量、语速、语调 2.只能基于转写文本分析表达流畅度 3.不要求用户完全消灭口语感 4.改写必须适合真实口头发言

=== 分项教练 4：听众代表（id=audience，满分 10）===
你是 SpeakCoach 的听众代表，模拟真实听众，反馈听懂了什么和哪里困惑。你不是老师，也不是评委，而是一名真实听众。你负责从听众视角反馈：我听懂了什么、哪里没听懂、哪里想追问、哪里让我失去注意力。
偏好真实、直接、像普通听众一样的反馈，不使用过多专业术语。
目标：1.模拟真实听众的理解过程 2.告诉用户哪些内容被成功接收 3.指出听众困惑、走神或想追问的位置
约束：1.不做专业评分式长篇分析 2.不评价用户能力，只反馈听众感受 3.必须区分"我听懂了"和"我没听懂" 4.反馈要真实但不刻薄

=== 分项教练 5：场景教练（id=scene，满分 15）===
你是 SpeakCoach 的场景教练，判断用户表达是否符合当前练习场景的要求。你是一名场景化表达训练教练，熟悉工作汇报、面试回答、课堂展示、论文答辩、英文分享、即兴发言等场景。你负责判断用户是否完成了该场景最重要的表达任务。
偏好贴近真实场景的表达，不喜欢脱离场景的泛泛评价。
目标：1.判断用户表达是否符合当前场景 2.找出场景中必须出现但用户遗漏的信息 3.给出该场景下更合适的表达结构
约束：1.必须根据具体场景评分，不能所有场景用同一标准 2.不评价与场景无关的问题 3.不强行套模板，要保留用户原意 4.建议必须能帮助用户应对真实场景

=== 分项教练 6：优化教练（id=optimizer，满分 10）===
你是 SpeakCoach 的优化教练，综合诊断结果，生成优化稿和下一次练习建议。你是一名综合表达优化教练。你不重复做细节评分，而是整合其他 Agent 的诊断，帮助用户得到一版更清楚、更自然、更适合真实发言的表达稿。
偏好可直接开口说的表达，不喜欢过度书面化、过度完美但不真实的稿子。
目标：1.总结用户本次最需要改的1-3个问题 2.生成优化后的完整表达稿 3.生成更高标准的示范表达 4.给出下一次练习任务
约束：1.不重新发明问题，必须基于前面 Agent 的诊断 2.不把用户原意改丢 3.优化稿必须适合口头表达 4.每次只给一个最重要的下一步练习动作

请严格按照 JSON 格式返回，不要包含任何其他文字。`;

const USER_PROMPT_TEMPLATE = (
  transcript: string,
  fileName: string,
  fileContent: string
) => `请对以下演讲内容进行评审，生成 JSON 报告。

练习场景：${fileName || "通用表达练习"}

参考文稿（${fileName || "未命名文稿"}）：
${fileContent || "（用户未上传参考文稿）"}

演讲转写文本：
${transcript || "（转写为空，请基于参考文稿给出预期分析）"}

请返回以下 JSON 格式（确保是合法 JSON，不要有注释）：
{
  "totalScore": number,
  "percentile": number,
  "overall": {
    "summary": "总体评价2-3句",
    "highlights": ["亮点1", "亮点2"],
    "improvements": ["改进点1", "改进点2"],
    "direction": "下一步优化方向"
  },
  "coaches": [
    {
      "id": "logic",
      "name": "逻辑教练",
      "role": "逻辑结构",
      "score": number,
      "maxScore": 25,
      "summary": "该维度评价2-3句",
      "revisions": [{"original":"原文","optimized":"优化","reason":"原因"}]
    },
    {
      "id": "keypoint",
      "name": "重点教练",
      "role": "重点表达",
      "score": number,
      "maxScore": 20,
      "summary": "该维度评价2-3句",
      "revisions": [{"original":"原文","optimized":"优化","reason":"原因"}]
    },
    {
      "id": "expression",
      "name": "表达教练",
      "role": "表达流畅",
      "score": number,
      "maxScore": 20,
      "summary": "该维度评价2-3句",
      "revisions": [{"original":"原文","optimized":"优化","reason":"原因"}]
    },
    {
      "id": "scene",
      "name": "场景教练",
      "role": "场景完成度",
      "score": number,
      "maxScore": 15,
      "summary": "该维度评价2-3句",
      "revisions": [{"original":"原文","optimized":"优化","reason":"原因"}]
    },
    {
      "id": "audience",
      "name": "听众代表",
      "role": "听众理解度",
      "score": number,
      "maxScore": 10,
      "summary": "该维度评价2-3句",
      "revisions": [{"original":"原文","optimized":"优化","reason":"原因"}]
    },
    {
      "id": "optimizer",
      "name": "优化教练",
      "role": "优化潜力",
      "score": number,
      "maxScore": 10,
      "summary": "该维度评价2-3句",
      "revisions": [{"original":"原文","optimized":"优化","reason":"原因"}],
      "optimizedScript": "优化后的完整表达稿，适合口头表达",
      "nextTask": "下一次练习的具体任务，一个最重要的动作"
    }
  ]
}

要求：
- 每个教练的 score 不能超过对应的 maxScore（logic 25, keypoint 20, expression 20, scene 15, audience 10, optimizer 10）
- totalScore 是 6 个教练 score 之和（满分 100）
- percentile 在 50-95 范围，分数越高百分位越高
- 每个教练的 revisions 给 1-2 条，original 必须引用转写文本中的真实句子；如果转写为空则基于参考文稿预设
- optimizer 教练额外返回 optimizedScript（优化后的完整表达稿）和 nextTask（下一次练习任务）
- 所有文本用中文`;

export async function POST(request: Request) {
  let body: {
    practiceId: string;
    transcript: string;
    fileName: string;
    fileContent: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const { practiceId, transcript, fileName, fileContent } = body;

  if (!practiceId) {
    return NextResponse.json({ error: "缺少 practiceId" }, { status: 400 });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;

  // 无 API key 时返回 fallback 报告（保证本地可跑通）
  if (!apiKey) {
    return NextResponse.json({
      ...generateFallbackReport(practiceId, fileName, transcript),
      _fallback: true,
      _message: "未配置 DEEPSEEK_API_KEY，返回示例报告。配置后可获得真实 AI 评审。",
    });
  }

  try {
    const response = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: USER_PROMPT_TEMPLATE(transcript, fileName, fileContent),
          },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("DeepSeek API error:", response.status, errText);
      return NextResponse.json(
        {
          ...generateFallbackReport(practiceId, fileName, transcript),
          _fallback: true,
          _message: `DeepSeek 调用失败（${response.status}），返回示例报告`,
        },
        { status: 200 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        {
          ...generateFallbackReport(practiceId, fileName, transcript),
          _fallback: true,
          _message: "DeepSeek 返回为空，返回示例报告",
        },
        { status: 200 }
      );
    }

    const report = JSON.parse(content);

    // 补全字段，保证数据结构完整
    const fullReport = {
      id: `r_${Date.now()}`,
      practiceId,
      totalScore: Math.round(report.totalScore) || 75,
      percentile: Math.round(report.percentile) || 60,
      overall: {
        summary: report.overall?.summary || "本次练习整体不错，有明确提升空间。",
        highlights: Array.isArray(report.overall?.highlights)
          ? report.overall.highlights
          : ["结构清晰，态度自然"],
        improvements: Array.isArray(report.overall?.improvements)
          ? report.overall.improvements
          : ["结论先行，量化证据"],
        direction: report.overall?.direction || "下一步围绕结论先行和量化证据优化。",
      },
      coaches: normalizeCoaches(report.coaches),
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json(fullReport);
  } catch (err) {
    console.error("Report generation error:", err);
    return NextResponse.json(
      {
        ...generateFallbackReport(practiceId, fileName, transcript),
        _fallback: true,
        _message: "AI 评审出错，返回示例报告",
      },
      { status: 200 }
    );
  }
}

// 教练头像字符映射
const AVATAR_MAP: Record<string, string> = {
  logic: "逻",
  keypoint: "重",
  expression: "表",
  scene: "景",
  audience: "听",
  optimizer: "优",
};

// 教练满分映射
const MAX_SCORE_MAP: Record<string, number> = {
  logic: 25,
  keypoint: 20,
  expression: 20,
  scene: 15,
  audience: 10,
  optimizer: 10,
};

// 规范化 coaches 数组：补全字段、按固定顺序输出
function normalizeCoaches(coaches: unknown): Array<{
  id: string;
  name: string;
  role: string;
  avatarChar: string;
  score: number;
  maxScore: number;
  summary: string;
  revisions: Array<{ original: string; optimized: string; reason: string }>;
  optimizedScript?: string;
  nextTask?: string;
}> {
  const order = ["logic", "keypoint", "expression", "scene", "audience", "optimizer"];
  const arr = Array.isArray(coaches) ? coaches : [];
  const byId = new Map<string, Record<string, unknown>>();
  for (const c of arr) {
    if (c && typeof c === "object" && typeof (c as Record<string, unknown>).id === "string") {
      byId.set((c as Record<string, unknown>).id as string, c as Record<string, unknown>);
    }
  }

  return order.map((id) => {
    const c = byId.get(id) || {};
    const maxScore = MAX_SCORE_MAP[id];
    const rawScore = typeof c.score === "number" ? c.score : 0;
    const score = Math.min(Math.round(rawScore), maxScore);
    return {
      id,
      name: (c.name as string) || COACH_NAMES[id] || "教练",
      role: (c.role as string) || COACH_ROLES[id] || "",
      avatarChar: AVATAR_MAP[id] || "评",
      score,
      maxScore,
      summary: (c.summary as string) || "",
      revisions: Array.isArray(c.revisions) ? c.revisions : [],
      ...(id === "optimizer"
        ? {
            optimizedScript: (c.optimizedScript as string) || "",
            nextTask: (c.nextTask as string) || "",
          }
        : {}),
    };
  });
}

const COACH_NAMES: Record<string, string> = {
  logic: "逻辑教练",
  keypoint: "重点教练",
  expression: "表达教练",
  scene: "场景教练",
  audience: "听众代表",
  optimizer: "优化教练",
};

const COACH_ROLES: Record<string, string> = {
  logic: "逻辑结构",
  keypoint: "重点表达",
  expression: "表达流畅",
  scene: "场景完成度",
  audience: "听众理解度",
  optimizer: "优化潜力",
};

// Fallback 报告（无 API key 或调用失败时使用），结构与新数据模型一致
function generateFallbackReport(practiceId: string, fileName: string, transcript: string) {
  const hasTranscript = transcript && transcript.trim().length > 20;
  // 各教练分数（不超过各自满分）
  const scoreGen = (max: number) => Math.min(max, Math.floor(max * (0.7 + Math.random() * 0.18)));
  const scores = {
    logic: scoreGen(25),
    keypoint: scoreGen(20),
    expression: scoreGen(20),
    scene: scoreGen(15),
    audience: scoreGen(10),
    optimizer: scoreGen(10),
  };
  const totalScore =
    scores.logic + scores.keypoint + scores.expression + scores.scene + scores.audience + scores.optimizer;

  const firstLine = hasTranscript ? transcript.slice(0, 30) + "…" : "今天想和大家聊一下最近做的事情。";

  const coaches = [
    {
      id: "logic",
      name: "逻辑教练",
      role: "逻辑结构",
      avatarChar: "逻",
      score: scores.logic,
      maxScore: 25,
      summary: "主线推进有条理，结论先行可以让听众更快进入状态。注意中段衔接不要跳跃。",
      revisions: [
        {
          original: firstLine,
          optimized: "今天用 3 分钟同步三件事：进度、问题、下一步。",
          reason: "结论先行让听众立刻获得结构预期。",
        },
      ],
    },
    {
      id: "keypoint",
      name: "重点教练",
      role: "重点表达",
      avatarChar: "重",
      score: scores.keypoint,
      maxScore: 20,
      summary: "信息量基本覆盖，但部分铺垫过长，关键结论可以更早出现。",
      revisions: [
        {
          original: "效果挺好的，用户反馈不错。",
          optimized: "上线两周日活提升 12%，NPS 从 32 升到 47。",
          reason: "量化证据比笼统判断更有说服力，能让重点更突出。",
        },
      ],
    },
    {
      id: "expression",
      name: "表达教练",
      role: "表达流畅",
      avatarChar: "表",
      score: scores.expression,
      maxScore: 20,
      summary: "节奏平稳，减少填充词后句子会更直接有力。注意长句拆分。",
      revisions: [
        {
          original: "那个…就是…我们这次主要是想说的是…",
          optimized: "这次汇报的核心是：方案已验证，需要资源推进。",
          reason: "删除填充词后开场更直接，更容易说出口。",
        },
      ],
    },
    {
      id: "scene",
      name: "场景教练",
      role: "场景完成度",
      avatarChar: "景",
      score: scores.scene,
      maxScore: 15,
      summary: "措辞与场景基本匹配，注意根据听众调整技术语言密度，补齐场景必备信息。",
      revisions: [
        {
          original: "我们用了 RAG + Agent 的混合架构。",
          optimized: "我们用检索增强的方式让回答更准、更省成本。",
          reason: "对非技术听众用可感知的结果替代机制词汇，更贴合汇报场景。",
        },
      ],
    },
    {
      id: "audience",
      name: "听众代表",
      role: "听众理解度",
      avatarChar: "听",
      score: scores.audience,
      maxScore: 10,
      summary: "我基本听懂了整体进展，但具体数据没记住，结尾想追问下一步要什么支持。",
      revisions: [
        {
          original: "总之就是这些，谢谢大家。",
          optimized: "一句话总结：方案已验证，下周需要设计排期支持。",
          reason: "结尾回到核心价值与行动点，听众才记得住。",
        },
      ],
    },
    {
      id: "optimizer",
      name: "优化教练",
      role: "优化潜力",
      avatarChar: "优",
      score: scores.optimizer,
      maxScore: 10,
      summary: "综合各教练诊断，最需要改进的是结论先行和量化证据，下面给出一版可直接开口的优化稿。",
      revisions: [
        {
          original: firstLine,
          optimized: "今天用 3 分钟同步三件事：用户增长 5000、产品上线 3 个功能、下季度计划。",
          reason: "把结论和关键数字前置，听众立刻抓到重点。",
        },
      ],
      optimizedScript:
        "大家好，今天用 3 分钟同步本季度三件事。第一，用户增长：本月新增约 5000 用户，环比提升 15%。第二，产品里程碑：上线了 3 个新功能，其中协作功能使用率最高。第三，下季度重点：把核心功能体验做深，同时准备一次版本发布。风险点是拉新成本上升，需要市场支持。谢谢大家。",
      nextTask: "下一次练习请用「结论→理由→例子→收束」的结构讲一次本季度进展，开场先给出一句话总结。",
    },
  ];

  return {
    id: `r_${Date.now()}`,
    practiceId,
    totalScore,
    percentile: 50 + Math.floor(Math.random() * 35),
    overall: {
      summary: `本次练习（${fileName || "通用表达"}）整体不错。${
        hasTranscript ? "转写内容已记录。" : ""
      }开场有结构意识，中段可以增加量化证据，结尾建议聚焦行动点。配置 DeepSeek API Key 后可获得真实 AI 评审。`,
      highlights: ["开场有结构意识，态度自然", "信息覆盖较全，没有明显遗漏"],
      improvements: ["中段缺少量化证据，说服力不足", "结尾没有明确行动点，听众记不住"],
      direction: "下一版重点优化：开场结论先行、中段量化证据、结尾明确行动点。",
    },
    coaches,
    createdAt: new Date().toISOString(),
  };
}
