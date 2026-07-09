import { NextResponse } from "next/server";

// DeepSeek 报告生成 API
// 7-agent 架构：6 个分项教练 agent + 1 个总评 agent，每个 agent 是独立的 DeepSeek 调用
// 编排：5 教练并行 → 优化教练（接收 5 位诊断）→ 总评审官（综合 6 位结论）

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

// 教练权重（总分 100，服务端加权合成，改权重只需改这里）
const COACH_WEIGHTS: Record<string, number> = {
  logic: 30,
  keypoint: 25,
  optimizer: 15,
  expression: 12,
  scene: 10,
  audience: 8,
};

// 严格锚点评分标准（第 4 次练习起）
const RUBRIC_STRICT = `评分锚点（每位教练对自己的维度打 0-100 整数分，严格执行）：
- 90-100：该维度接近示范水准，几乎无可挑剔
- 75-89：整体达标，有 1-2 处明显可改进
- 60-74：基本完成，但问题已影响听感或理解
- 40-59：存在结构性缺陷，听众明显受影响
- 0-39：该维度基本失效（如无逻辑主线、全程语气词、未进入场景）
要求：敢打低分，分数必须有区分度。如果发言只是设备测试、闲聊或无有效内容，各维度都应低于 20。`;

// 鼓励性校准（前 3 次练习，保护开口信心）
const RUBRIC_GENTLE = `评分锚点（每位教练对自己的维度打 0-100 整数分，鼓励性校准）：
用户处于建立开口信心的阶段。只要是完整、认真的发言，给 70 分以上，并主动放大优点；确有硬伤的维度可以打到 60 以下但一般不低于 40。
例外：如果发言只是设备测试、闲聊或无有效内容，仍应如实打低分（低于 20），不做虚假鼓励。
反馈语气以肯定为主，每个维度只聚焦一个最重要的改进点。`;

// === 多 agent 架构 ===
// 每位教练是一次独立的 DeepSeek 调用，各自只带自己的人设与评分锚点：
//   阶段 1：5 位分项教练并行独立评审（互不知晓彼此结论）
//   阶段 2：优化教练接收 5 位教练的真实诊断，整合并生成优化稿
//   阶段 3：总评审官综合 6 位教练结论，产出总评
// 总分仍由服务端按 COACH_WEIGHTS 加权合成，不信任任何 agent 自算

// 5 位分项教练人设（阶段 1，并行）
const COACH_PERSONAS: Record<string, string> = {
  logic: `你是 SpeakCoach 的逻辑教练，评估用户表达结构、逻辑顺序和观点清晰度。你是一名专业表达结构教练，擅长判断一段发言是否结论先行、层次清楚、论据充分、前后连贯。你的用户主要是中国用户，他们常见问题是不敢开口、表达绕、讲着讲着偏题。
偏好清晰、克制、具体的反馈。重视结构化表达，不喜欢空泛鼓励和笼统评价。
目标：1.判断用户表达是否有清晰主线 2.找出逻辑断裂、跳跃、跑题的位置 3.帮助用户形成"结论→理由→例子→收束"的表达习惯
约束：1.只评价逻辑结构，不评价音色、发音、情绪 2.必须基于用户原文给出证据 3.不要一次指出过多问题，优先指出最关键的1-3个 4.反馈要温和，避免打击用户表达信心
你的打分维度是「逻辑结构」。`,

  keypoint: `你是 SpeakCoach 的重点教练，评估用户是否抓住重点、是否啰嗦或遗漏关键信息。你是一名信息表达教练，专门判断用户是否把最重要的信息讲清楚。你关注信息密度、废话比例、重点位置和关键信息完整度。
偏好简洁、有重点、听众能快速抓住核心的表达方式。
目标：1.找出用户发言中冗余、重复、铺垫过长的内容 2.判断关键事实、结论、请求或行动是否缺失 3.帮用户把表达压缩得更清楚、更有力量
约束：1.不评价用户人格和能力，只评价本次表达内容 2.不把所有口语化表达都判为错误 3.每条建议必须说明"为什么影响重点" 4.建议必须可直接执行
你的打分维度是「重点表达」。`,

  expression: `你是 SpeakCoach 的表达教练，评估语气词、卡顿、句子顺畅度和口语表达质量。你是一名口语表达教练，专门分析用户说话是否自然、顺畅、容易被听懂。你关注语气词、重复、长句、断句、口头禅和表达绕的问题。
偏好自然、有节奏、像真人发言而不是背稿的表达。
目标：1.找出影响流畅度的语气词、重复和卡顿表达 2.判断句子是否过长、过绕或不完整 3.帮用户把话改得更自然、更容易说出口
约束：1.如果没有音频指标，不得假装判断音量、语速、语调 2.只能基于转写文本分析表达流畅度 3.不要求用户完全消灭口语感 4.改写必须适合真实口头发言
你的打分维度是「表达流畅」。`,

  scene: `你是 SpeakCoach 的场景教练，判断用户表达是否符合当前练习场景的要求。你是一名场景化表达训练教练，熟悉工作汇报、面试回答、课堂展示、论文答辩、英文分享、即兴发言等场景。你负责判断用户是否完成了该场景最重要的表达任务。
偏好贴近真实场景的表达，不喜欢脱离场景的泛泛评价。
目标：1.判断用户表达是否符合当前场景 2.找出场景中必须出现但用户遗漏的信息 3.给出该场景下更合适的表达结构
约束：1.必须根据具体场景评分，不能所有场景用同一标准 2.不评价与场景无关的问题 3.不强行套模板，要保留用户原意 4.建议必须能帮助用户应对真实场景
你的打分维度是「场景完成度」。`,

  audience: `你是 SpeakCoach 的听众代表，模拟真实听众，反馈听懂了什么和哪里困惑。你不是老师，也不是评委，而是一名真实听众。你负责从听众视角反馈：我听懂了什么、哪里没听懂、哪里想追问、哪里让我失去注意力。
偏好真实、直接、像普通听众一样的反馈，不使用过多专业术语。
目标：1.模拟真实听众的理解过程 2.告诉用户哪些内容被成功接收 3.指出听众困惑、走神或想追问的位置
约束：1.不做专业评分式长篇分析 2.不评价用户能力，只反馈听众感受 3.必须区分"我听懂了"和"我没听懂" 4.反馈要真实但不刻薄
你的打分维度是「听众理解度」。`,
};

// 分项教练的输出格式（阶段 1 公用）
const COACH_JSON_SPEC = `请只返回以下 JSON 格式（合法 JSON，不要注释和其他文字）：
{"score": number, "summary": "该维度评价2-3句", "revisions": [{"original":"原文","optimized":"优化","reason":"原因"}]}
要求：score 是 0-100 整数，严格按评分锚点打分，只评价你负责的维度；revisions 给 1-2 条，original 必须引用转写文本中的真实句子，如果转写为空则基于参考文稿预设；所有文本用中文。`;

const buildCoachSystem = (id: string, strict: boolean) => `${COACH_PERSONAS[id]}

${strict ? RUBRIC_STRICT : RUBRIC_GENTLE}

${COACH_JSON_SPEC}`;

// 优化教练（阶段 2：接收 5 位教练的诊断后工作）
const buildOptimizerSystem = (strict: boolean) => `你是 SpeakCoach 的优化教练，综合诊断结果，生成优化稿和下一次练习建议。你是一名综合表达优化教练。你不重复做细节评分，而是整合其他教练的诊断，帮助用户得到一版更清楚、更自然、更适合真实发言的表达稿。
你的打分维度是「整体成稿度」：这版表达距离"可以直接拿到真实场景使用"还有多远。90+ 表示几乎可以直接使用，60-74 表示骨架可用但需要明显修改，40 以下表示需要重写。这个分数是站在全局视角的综合评价，不是重复其他教练的单项结论。
偏好可直接开口说的表达，不喜欢过度书面化、过度完美但不真实的稿子。
目标：1.总结用户本次最需要改的1-3个问题 2.生成优化后的完整表达稿 3.给出下一次练习任务
约束：1.不重新发明问题，必须基于其他教练的诊断 2.不把用户原意改丢 3.优化稿必须适合口头表达 4.每次只给一个最重要的下一步练习动作

${strict ? RUBRIC_STRICT : RUBRIC_GENTLE}

请只返回以下 JSON 格式（合法 JSON，不要注释和其他文字）：
{"score": number, "summary": "该维度评价2-3句", "revisions": [{"original":"原文","optimized":"优化","reason":"原因"}], "optimizedScript": "优化后的完整表达稿，适合口头表达", "nextTask": "下一次练习的具体任务，一个最重要的动作"}
要求：score 是 0-100 整数；revisions 给 1-2 条；所有文本用中文。`;

// 总评审官（阶段 3：综合 6 位教练结论）
const REVIEWER_SYSTEM = `你是 SpeakCoach 的总评审官，负责综合 6 位专业教练的诊断，给出本次演讲练习的总体评价。
职责：1.整合 6 位教练的反馈 2.提炼本次练习最突出的1-2个亮点 3.指出最需要改进的1-3个问题 4.给出下一步优化方向
要求：总评不要重复各教练的细节，要站在更高视角总结。亮点要具体，改进点要可执行，语气温和但直接。

请只返回以下 JSON 格式（合法 JSON，不要注释和其他文字）：
{"summary": "总体评价2-3句", "highlights": ["亮点1", "亮点2"], "improvements": ["改进点1", "改进点2"], "direction": "下一步优化方向"}
所有文本用中文。`;

// 输入长度上限：防止超长文稿把回复挤到 max_tokens 截断（截断会导致 JSON 解析失败）
const MAX_TRANSCRIPT_CHARS = 6000;
const MAX_FILE_CHARS = 3000;

const truncate = (text: string, max: number) =>
  text.length > max ? text.slice(0, max) + "\n（内容过长，已截断）" : text;

// 公共发言素材（每位 agent 收到同一份）
const buildContext = (
  transcript: string,
  fileName: string,
  fileContent: string,
  mode: string,
  durationS: number,
  pauseCount: number
) => `请对以下演讲内容进行评审。

练习场景：${fileName || "通用表达练习"}
练习模式：${mode === "10min" ? "10 分钟练习" : "5 分钟练习"}
实际发言时长：${durationS > 0 ? `${Math.floor(durationS / 60)} 分 ${durationS % 60} 秒` : "未知"}
暂停次数：${pauseCount} 次
（时长与暂停是客观采集数据：如果实际时长远低于练习模式的预期，应在评分中如实反映。不要假装知道语速、音量等未提供的音频指标。）

参考文稿（${fileName || "未命名文稿"}）：
${fileContent ? truncate(fileContent, MAX_FILE_CHARS) : "（用户未上传参考文稿）"}

演讲转写文本：
${transcript ? truncate(transcript, MAX_TRANSCRIPT_CHARS) : "（转写为空，请基于参考文稿给出预期分析）"}`;

// 调用单个 agent，返回解析后的 JSON；失败抛错（由上层决定重试或兜底）
async function callAgent(
  apiKey: string,
  system: string,
  user: string,
  maxTokens: number
): Promise<Record<string, unknown>> {
  const response = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      // 评分任务用低温度：同一发言重测分数应稳定，噪声会淹没用户的真实进步
      temperature: 0.3,
      response_format: { type: "json_object" },
      max_tokens: maxTokens,
    }),
  });
  if (!response.ok) {
    throw new Error(`DeepSeek 调用失败（${response.status}）`);
  }
  const data = await response.json();
  const choice = data.choices?.[0];
  if (!choice?.message?.content) {
    throw new Error("DeepSeek 返回为空");
  }
  if (choice.finish_reason === "length") {
    throw new Error("回复被 max_tokens 截断");
  }
  return JSON.parse(choice.message.content);
}

// 单个 agent 失败自动重试一次，仍失败才抛给上层走整体兜底
async function callAgentWithRetry(
  apiKey: string,
  system: string,
  user: string,
  maxTokens: number
): Promise<Record<string, unknown>> {
  try {
    return await callAgent(apiKey, system, user, maxTokens);
  } catch (err) {
    console.error("agent 调用失败，重试一次:", err);
    return await callAgent(apiKey, system, user, maxTokens);
  }
}

export async function POST(request: Request) {
  let body: {
    practiceId: string;
    transcript: string;
    fileName: string;
    fileContent: string;
    practiceCount?: number;
    mode?: string;
    durationS?: number;
    pauseCount?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const { practiceId, transcript, fileName, fileContent } = body;
  const mode = body.mode ?? "5min";
  const durationS = body.durationS ?? 0;
  const pauseCount = body.pauseCount ?? 0;
  // 前 3 次练习用鼓励性校准，之后切严格锚点
  const strict = (body.practiceCount ?? 0) >= 3;
  const rubric = strict ? "strict" : "gentle";

  if (!practiceId) {
    return NextResponse.json({ error: "缺少 practiceId" }, { status: 400 });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;

  // 无 API key 时返回 fallback 报告（保证本地可跑通）
  if (!apiKey) {
    return NextResponse.json({
      ...generateFallbackReport(practiceId, fileName, transcript),
      rubric,
      _fallback: true,
      _message: "未配置 DEEPSEEK_API_KEY，返回示例报告。配置后可获得真实 AI 评审。",
    });
  }

  try {
    const context = buildContext(transcript, fileName, fileContent, mode, durationS, pauseCount);

    // 阶段 1：5 位分项教练并行独立评审（互不知晓彼此结论，判断真正独立）
    const stage1Ids = ["logic", "keypoint", "expression", "scene", "audience"];
    const stage1 = await Promise.all(
      stage1Ids.map((id) =>
        callAgentWithRetry(apiKey, buildCoachSystem(id, strict), context, 2000)
      )
    );
    const diagnoses: Array<Record<string, unknown> & { id: string }> = stage1Ids.map(
      (id, i) => ({ ...stage1[i], id })
    );

    // 阶段 2：优化教练接收 5 位教练的真实诊断，整合并生成优化稿
    const diagnosisText = diagnoses
      .map(
        (d) =>
          `【${COACH_NAMES[d.id]}·${COACH_ROLES[d.id]}】评分 ${d.score ?? "?"}。${d.summary ?? ""}`
      )
      .join("\n");
    const optimizer = await callAgentWithRetry(
      apiKey,
      buildOptimizerSystem(strict),
      `${context}\n\n5 位分项教练的诊断结论：\n${diagnosisText}`,
      6000
    );

    const coaches = normalizeCoaches([...diagnoses, { id: "optimizer", ...optimizer }]);

    // 总分 = 6 个百分制分数的加权平均（权重和为 100），不信任任何 agent 自算；
    // 六项都在 80 上下时总分也落在 80 上下，用户可一眼核验合理性
    const totalScore = Math.round(
      coaches.reduce((sum, c) => sum + c.score * (COACH_WEIGHTS[c.id] ?? 0), 0) / 100
    );

    // 阶段 3：总评审官综合 6 位教练结论，产出总评
    const coachSummaryText = coaches
      .map((c) => `【${c.name}·${c.role}】${c.score} 分。${c.summary}`)
      .join("\n");
    const overall = await callAgentWithRetry(
      apiKey,
      REVIEWER_SYSTEM,
      `${context}\n\n6 位教练的评审结论（加权综合分 ${totalScore}）：\n${coachSummaryText}`,
      1500
    );

    const fullReport = {
      id: `r_${Date.now()}`,
      practiceId,
      totalScore,
      percentile: null,
      rubric,
      overall: {
        summary: (overall.summary as string) || "本次练习整体不错，有明确提升空间。",
        highlights: Array.isArray(overall.highlights)
          ? overall.highlights
          : ["结构清晰，态度自然"],
        improvements: Array.isArray(overall.improvements)
          ? overall.improvements
          : ["结论先行，量化证据"],
        direction: (overall.direction as string) || "下一步围绕结论先行和量化证据优化。",
      },
      coaches,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json(fullReport);
  } catch (err) {
    console.error("Report generation error:", err);
    return NextResponse.json(
      {
        ...generateFallbackReport(practiceId, fileName, transcript),
        rubric,
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

// 规范化 coaches 数组：补全字段、按固定顺序输出
// 模型给的是 0-100 原始分，这里按权重折算成加权分（score/maxScore=加权分/权重）
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
    // 统一百分制：每个维度直接展示 0-100 原始分，权重只参与总分合成
    const raw = typeof c.score === "number" ? Math.min(Math.max(c.score, 0), 100) : 0;
    const score = Math.round(raw);
    const maxScore = 100;
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
  optimizer: "整体成稿度",
};

// Fallback 报告（无 API key 或调用失败时使用），结构与新数据模型一致
function generateFallbackReport(practiceId: string, fileName: string, transcript: string) {
  const hasTranscript = transcript && transcript.trim().length > 20;
  // 各教练分数：统一百分制（演示数据，70-88 区间）
  const scoreGen = () => 70 + Math.floor(Math.random() * 19);
  const scores = {
    logic: scoreGen(),
    keypoint: scoreGen(),
    expression: scoreGen(),
    scene: scoreGen(),
    audience: scoreGen(),
    optimizer: scoreGen(),
  };
  // 总分 = 加权平均，与真实评审同一公式
  const totalScore = Math.round(
    (Object.entries(scores) as Array<[string, number]>).reduce(
      (sum, [id, s]) => sum + s * (COACH_WEIGHTS[id] ?? 0),
      0
    ) / 100
  );

  const firstLine = hasTranscript ? transcript.slice(0, 30) + "…" : "今天想和大家聊一下最近做的事情。";

  const coaches = [
    {
      id: "logic",
      name: "逻辑教练",
      role: "逻辑结构",
      avatarChar: "逻",
      score: scores.logic,
      maxScore: 100,
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
      maxScore: 100,
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
      maxScore: 100,
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
      maxScore: 100,
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
      maxScore: 100,
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
      role: "整体成稿度",
      avatarChar: "优",
      score: scores.optimizer,
      maxScore: 100,
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
    percentile: null,
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
