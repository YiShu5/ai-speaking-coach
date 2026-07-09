// WebSocket 代理服务：浏览器 ↔ 阿里云 Paraformer 实时语音识别
// 浏览器无法设置 Authorization header，所以需要后端代理
// 启动：node ws-proxy.mjs（端口 3001）

import { WebSocketServer } from "ws";
import WebSocket from "ws";
import { readFileSync } from "fs";
import { resolve } from "path";
import { randomUUID } from "crypto";

// 手动加载 .env.local（不依赖 dotenv）
function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch (e) {
    console.error("无法读取 .env.local:", e.message);
  }
}

loadEnv();

const apiKey = process.env.DASHSCOPE_API_KEY;
if (!apiKey) {
  console.error("❌ 未配置 DASHSCOPE_API_KEY，请在 .env.local 中设置");
  process.exit(1);
}

const DASHSCOPE_WS_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/inference/";
const PORT = process.env.WS_PROXY_PORT || 3001;

const wss = new WebSocketServer({ port: PORT });

console.log(`✅ WebSocket 代理服务已启动: ws://localhost:${PORT}`);
console.log(`   转发到阿里云 Paraformer realtime-v2`);

wss.on("connection", (clientWs, req) => {
  const taskId = randomUUID();
  let dashWs = null;
  let dashReady = false;
  let clientClosed = false;

  console.log(`[${taskId}] 浏览器已连接`);

  // 连接阿里云 Paraformer WebSocket
  dashWs = new WebSocket(DASHSCOPE_WS_URL, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  dashWs.on("open", () => {
    console.log(`[${taskId}] 已连接阿里云，发送 run-task`);
    dashWs.send(
      JSON.stringify({
        header: {
          action: "run-task",
          task_id: taskId,
          streaming: "duplex",
        },
        payload: {
          task_group: "audio",
          task: "asr",
          function: "recognition",
          model: "paraformer-realtime-v2",
          input: {},
          parameters: {
            format: "pcm",
            sample_rate: 16000,
            language_hints: ["zh", "en"],
            disfluency_removal_enabled: false,
            punctuation_prediction_enabled: true,
            inverse_text_normalization_enabled: true,
            heartbeat: true,
          },
        },
      })
    );
  });

  dashWs.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    const event = msg.header?.event;

    if (event === "task-started") {
      console.log(`[${taskId}] 任务已启动，可以发送音频`);
      dashReady = true;
      if (!clientClosed) {
        clientWs.send(JSON.stringify({ type: "ready" }));
      }
    } else if (event === "result-generated") {
      const sentence = msg.payload?.output?.sentence;
      if (sentence && !clientClosed) {
        // 跳过心跳包
        if (sentence.heartbeat) return;
        clientWs.send(
          JSON.stringify({
            type: "result",
            text: sentence.text || "",
            sentenceEnd: !!sentence.sentence_end,
            // 句级起止时间（毫秒），用于客户端计算语速/停顿指标
            beginMs: typeof sentence.begin_time === "number" ? sentence.begin_time : null,
            endMs: typeof sentence.end_time === "number" ? sentence.end_time : null,
          })
        );
      }
    } else if (event === "task-finished") {
      console.log(`[${taskId}] 任务完成`);
      if (!clientClosed) {
        clientWs.send(JSON.stringify({ type: "finished" }));
      }
      cleanup();
    } else if (event === "task-failed") {
      const errMsg = msg.header?.error_message || "识别失败";
      console.error(`[${taskId}] 任务失败:`, errMsg);
      if (!clientClosed) {
        clientWs.send(JSON.stringify({ type: "error", message: errMsg }));
      }
      cleanup();
    }
  });

  dashWs.on("error", (err) => {
    console.error(`[${taskId}] 阿里云连接错误:`, err.message);
    if (!clientClosed) {
      clientWs.send(
        JSON.stringify({
          type: "error",
          message: `连接阿里云失败: ${err.message}`,
        })
      );
    }
  });

  dashWs.on("close", () => {
    console.log(`[${taskId}] 阿里云连接关闭`);
    if (!clientClosed && dashReady) {
      clientWs.send(JSON.stringify({ type: "finished" }));
    }
  });

  // 浏览器发来的消息
  clientWs.on("message", (data, isBinary) => {
    if (isBinary) {
      // 二进制 = PCM 音频数据，转发到阿里云
      if (dashWs?.readyState === WebSocket.OPEN && dashReady) {
        dashWs.send(data);
      }
    } else {
      // 文本消息 = JSON 指令
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (msg.type === "finish" && dashWs?.readyState === WebSocket.OPEN) {
        console.log(`[${taskId}] 收到 finish 指令，发送 finish-task`);
        dashWs.send(
          JSON.stringify({
            header: {
              action: "finish-task",
              task_id: taskId,
              streaming: "duplex",
            },
            payload: { input: {} },
          })
        );
      }
    }
  });

  clientWs.on("close", () => {
    console.log(`[${taskId}] 浏览器断开连接`);
    clientClosed = true;
    cleanup();
  });

  clientWs.on("error", (err) => {
    console.error(`[${taskId}] 浏览器连接错误:`, err.message);
    clientClosed = true;
    cleanup();
  });

  function cleanup() {
    if (dashWs && dashWs.readyState === WebSocket.OPEN) {
      try {
        dashWs.close();
      } catch {
        // ignore
      }
    }
  }
});
