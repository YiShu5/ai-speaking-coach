"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Pause, Play, Square, Mic, Video, VideoOff, AlertCircle, Loader2 } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { REVIEWERS } from "@/lib/reviewers";
import { finishPractice } from "@/lib/mock-api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { formatTime } from "@/lib/utils";

type Phase = "idle" | "connecting" | "live" | "paused" | "finishing" | "done";

export default function PracticePage() {
  useRequireAuth();
  const router = useRouter();
  const {
    mode,
    fileName,
    practiceId,
    status,
    setStatus,
    elapsed,
    setElapsed,
    pauseCount,
    incPause,
    resetPractice,
    showToast,
  } = useAppStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalTextRef = useRef("");
  const interimTextRef = useRef("");
  const isPausedRef = useRef(false);
  const finishResolveRef = useRef<((value: string) => void) | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");

  // 初始化摄像头 + 麦克风
  useEffect(() => {
    let mounted = true;
    async function initMedia() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("浏览器不支持媒体采集，建议使用 Chrome");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 800 },
          audio: true,
        });
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraReady(true);
      } catch (err) {
        // 视频被拒绝但音频可能可用
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (!mounted) {
            audioOnly.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = audioOnly;
          setCameraError("摄像头未授权，但仍可录音练习");
          setCameraReady(false);
        } catch {
          setMicError("麦克风未授权，无法录音练习。请授权后重试");
          setCameraError("摄像头未授权");
        }
      }
    }
    initMedia();
    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // 计时
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsed(useAppStore.getState().elapsed + 1);
    }, 1000);
  }, [setElapsed]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 开始录音（AudioWorklet + WebSocket 实时转写）
  async function handleRecord() {
    if (phase !== "idle") return;
    if (!streamRef.current) {
      showToast("请先授权麦克风");
      return;
    }

    setPhase("connecting");
    setTranscribeError(null);
    finalTextRef.current = "";
    interimTextRef.current = "";
    setFinalText("");
    setInterimText("");
    isPausedRef.current = false;

    try {
      // 1. 创建 AudioContext + 加载 AudioWorklet
      const audioContext = new AudioContext();
      await audioContext.audioWorklet.addModule("/pcm-processor.js");
      audioContextRef.current = audioContext;

      // 2. 从 stream 获取音频轨道
      const audioTracks = streamRef.current.getAudioTracks();
      if (audioTracks.length === 0) {
        setMicError("没有可用的音频轨道");
        setPhase("idle");
        await audioContext.close();
        return;
      }
      const audioStream = new MediaStream(audioTracks);
      const source = audioContext.createMediaStreamSource(audioStream);
      sourceRef.current = source;

      const workletNode = new AudioWorkletNode(audioContext, "pcm-processor");
      workletNodeRef.current = workletNode;

      // 3. 连接 WebSocket 代理
      const ws = new WebSocket("ws://localhost:3001");
      wsRef.current = ws;

      ws.onmessage = (event) => {
        let msg: { type: string; text?: string; sentenceEnd?: boolean; message?: string };
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.type === "ready") {
          // 阿里云已就绪，连接音频管线，开始发送音频
          source.connect(workletNode);
          setPhase("live");
          setStatus("live");
          setElapsed(0);
          startTimer();
        } else if (msg.type === "result") {
          if (msg.sentenceEnd) {
            // 句子结束，追加到最终文本
            finalTextRef.current += msg.text || "";
            interimTextRef.current = "";
            setFinalText(finalTextRef.current);
            setInterimText("");
          } else {
            // 中间结果
            interimTextRef.current = msg.text || "";
            setInterimText(msg.text || "");
          }
        } else if (msg.type === "finished") {
          // 转写完成
          const final = finalTextRef.current + interimTextRef.current;
          if (finishResolveRef.current) {
            finishResolveRef.current(final);
            finishResolveRef.current = null;
          }
        } else if (msg.type === "error") {
          setTranscribeError(msg.message || "语音识别出错");
          if (finishResolveRef.current) {
            finishResolveRef.current(finalTextRef.current + interimTextRef.current);
            finishResolveRef.current = null;
          }
        }
      };

      ws.onerror = () => {
        setTranscribeError("语音识别连接失败，请确认 ws-proxy 已启动");
        // connecting 阶段 status 仍为 idle，回到 idle 状态让用户重试
        if (useAppStore.getState().status === "idle") {
          setPhase("idle");
        }
      };

      // 4. AudioWorklet 采集 PCM → 发送到 WebSocket
      workletNode.port.onmessage = (e: MessageEvent) => {
        if (isPausedRef.current) return;
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(e.data); // ArrayBuffer (Int16 PCM)
        }
      };
    } catch (err) {
      console.error("启动录音失败:", err);
      setTranscribeError("启动录音失败");
      setPhase("idle");
    }
  }

  // 暂停/继续
  function handlePauseResume() {
    const cur = useAppStore.getState().status;
    if (cur === "live") {
      setStatus("paused");
      stopTimer();
      incPause();
      setPhase("paused");
      isPausedRef.current = true;
    } else if (cur === "paused") {
      setStatus("live");
      setPhase("live");
      startTimer();
      isPausedRef.current = false;
    }
  }

  // 结束录音 → 等待最终转写 → 生成报告
  async function handleEnd() {
    setConfirmEnd(false);
    setPhase("finishing");
    stopTimer();
    setStatus("paused");
    isPausedRef.current = true;

    // 停止发送音频
    if (workletNodeRef.current) {
      workletNodeRef.current.port.onmessage = null;
    }
    try {
      sourceRef.current?.disconnect();
    } catch {
      // ignore
    }

    // 发送 finish 指令，等待最终结果
    let finalTranscript = finalTextRef.current + interimTextRef.current;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const finishPromise = new Promise<string>((resolve) => {
        finishResolveRef.current = resolve;
        // 超时 15 秒
        setTimeout(() => {
          if (finishResolveRef.current) {
            finishResolveRef.current(finalTextRef.current + interimTextRef.current);
            finishResolveRef.current = null;
          }
        }, 15000);
      });
      wsRef.current.send(JSON.stringify({ type: "finish" }));
      finalTranscript = await finishPromise;
    }

    // 关闭 WebSocket
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }

    // 关闭 AudioContext
    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }

    // 停止摄像头
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // 保存练习记录
    const finalElapsed = useAppStore.getState().elapsed;
    const finalPauseCount = useAppStore.getState().pauseCount;
    if (practiceId) {
      await finishPractice(practiceId, finalTranscript, finalElapsed, finalPauseCount);
      setPhase("done");
      router.push(`/report/${practiceId}`);
    }
  }

  // 离开页面清理
  useEffect(() => {
    return () => {
      stopTimer();
      if (workletNodeRef.current) {
        try {
          workletNodeRef.current.port.onmessage = null;
        } catch {
          // ignore
        }
      }
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch {
          // ignore
        }
      }
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch {
          // ignore
        }
      }
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [stopTimer]);

  const modeLabel = mode === "5min" ? "5分钟快速汇报" : "10分钟演讲";
  const statusLabel =
    phase === "idle" ? "准备中" :
    phase === "connecting" ? "连接中" :
    phase === "live" ? "练习中" :
    phase === "paused" ? "已暂停" :
    phase === "finishing" ? "处理中" : "已完成";

  const statusBg =
    phase === "idle" || phase === "connecting"
      ? "rgba(255,255,255,0.9)"
      : "linear-gradient(135deg, var(--blue), var(--lavender))";

  const panelStatus =
    phase === "idle" ? "等待开始" :
    phase === "connecting" ? "连接中" :
    phase === "live" ? "转写中" :
    phase === "paused" ? "已暂停" :
    phase === "finishing" ? "收尾中" : "已完成";

  // 是否有转写内容可显示
  const hasTranscript = finalText || interimText;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--stage)]">
      {/* 结束收尾 loading 遮罩 */}
      <AnimatePresence>
        {phase === "finishing" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--stage)] text-white"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
              className="mb-6 h-12 w-12 rounded-full border-4 border-white/20 border-t-white"
            />
            <p className="text-lg font-bold">正在生成最终转写…</p>
            <p className="mt-2 text-sm text-white/60">等待最后几秒的语音识别结果</p>
            {transcribeError && (
              <p className="mt-3 text-sm text-red-300">{transcribeError}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 顶部栏 */}
      <div className="flex shrink-0 items-center justify-between px-10 pt-6 pb-2">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">
            Live rehearsal
          </div>
          <div className="text-lg font-bold text-white/90">模拟会议室</div>
        </div>
        <div
          className="flex items-center gap-4 rounded-full px-5 py-2.5"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <span
            className="font-black tabular-nums text-white"
            style={{ fontSize: "clamp(28px, 2.5vw, 38px)" }}
          >
            {formatTime(elapsed)}
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
            {modeLabel}
          </span>
        </div>
      </div>

      {/* 会议布局 */}
      <div
        className="grid min-h-0 flex-1 gap-5 px-10 pb-6"
        style={{
          gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 0.34fr)",
        }}
      >
        {/* 左：视频列 */}
        <div className="flex min-h-0 flex-col gap-5">
          {/* 摄像头舞台 */}
          <div
            className="relative min-h-0 flex-1 overflow-hidden rounded-[30px] bg-black"
            style={{ boxShadow: "var(--shadow)" }}
          >
            {/* 6 评审悬浮 */}
            <div className="absolute left-1/2 top-5 z-20 flex -translate-x-1/2 gap-3">
              {REVIEWERS.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08, type: "spring", stiffness: 200 }}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/80 font-bold text-white"
                    style={{
                      background: "linear-gradient(135deg, var(--blue), var(--lavender))",
                    }}
                  >
                    {r.avatarChar}
                  </div>
                  <span className="text-[11px] font-bold text-white drop-shadow-lg">
                    {r.name}
                  </span>
                </motion.div>
              ))}
            </div>

            {/* 视频 */}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />

            {/* Fallback */}
            {(!cameraReady || cameraError) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/60">
                {cameraError ? <AlertCircle size={36} /> : <VideoOff size={36} />}
                <div className="text-sm font-bold">
                  {cameraError ?? "摄像头未开启"}
                </div>
                {!cameraError && (
                  <div className="text-xs text-white/40">浏览器授权后会显示画面</div>
                )}
              </div>
            )}

            {/* 顶部渐变遮罩 */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-24"
              style={{
                background: "linear-gradient(180deg, rgba(32,39,53,0.5), rgba(32,39,53,0))",
              }}
            />

            {/* 底部覆盖层 */}
            <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between">
              <div
                className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold backdrop-blur"
                style={{
                  background: statusBg,
                  color: phase === "idle" || phase === "connecting" ? "var(--ink)" : "#fff",
                }}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    phase === "live" ? "animate-pulse bg-red-400" : "bg-current opacity-50"
                  }`}
                />
                {statusLabel}
              </div>
              {fileName && (
                <div className="flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-xs text-white/80 backdrop-blur">
                  <Video size={12} />
                  <span className="max-w-[200px] truncate">{fileName}</span>
                </div>
              )}
            </div>
          </div>

          {/* 控制栏 */}
          <div
            className="flex shrink-0 items-center justify-between rounded-full px-6 py-4"
            style={{
              background: "rgba(255,255,255,0.95)",
              boxShadow: "var(--soft-shadow)",
            }}
          >
            {/* 暂停 */}
            <button
              onClick={handlePauseResume}
              disabled={phase === "idle" || phase === "connecting" || phase === "finishing"}
              className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-[var(--ink)] transition-colors hover:bg-[var(--soft)] disabled:opacity-40"
            >
              {phase === "paused" ? <Play size={18} /> : <Pause size={18} />}
              {phase === "paused" ? "继续" : "暂停"}
            </button>

            {/* 录音按钮 */}
            <motion.button
              onClick={handleRecord}
              disabled={phase !== "idle"}
              whileHover={phase === "idle" ? { scale: 1.05 } : {}}
              whileTap={phase === "idle" ? { scale: 0.95 } : {}}
              className="relative flex h-[82px] w-[82px] items-center justify-center rounded-full text-white"
              style={{
                background: "linear-gradient(135deg, var(--blue), var(--lavender))",
                boxShadow: "var(--record-shadow)",
              }}
            >
              {phase === "connecting" ? (
                <Loader2 size={32} className="animate-spin" />
              ) : phase === "live" || phase === "paused" ? (
                <div className="wave-bars">
                  <span /><span /><span /><span /><span />
                </div>
              ) : (
                <Mic size={32} />
              )}
              {phase === "live" && (
                <motion.span
                  className="absolute inset-0 rounded-full border-2 border-[var(--blue)]"
                  animate={{ scale: [1, 1.3], opacity: [0.6, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
            </motion.button>

            {/* 结束 */}
            <button
              onClick={() => (phase === "live" || phase === "paused") && setConfirmEnd(true)}
              disabled={phase === "idle" || phase === "connecting" || phase === "finishing"}
              className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white transition-colors hover:opacity-90 disabled:opacity-40"
              style={{ background: "#e85a5a" }}
            >
              <Square size={16} />
              结束
            </button>
          </div>
        </div>

        {/* 右：实时转写面板 */}
        <div
          className="flex min-h-0 flex-col overflow-hidden rounded-[30px] bg-white"
          style={{ boxShadow: "var(--shadow)" }}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--line)] px-5 py-4">
            <h2 className="text-base font-extrabold text-[var(--ink)]">实时转写</h2>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                phase === "live" || phase === "connecting" || phase === "finishing"
                  ? "bg-[var(--soft-blue)] text-[var(--blue-deep)]"
                  : "bg-[var(--soft)] text-[var(--muted)]"
              }`}
            >
              {panelStatus}
            </span>
          </div>

          <div className="scroll-soft flex-1 overflow-y-auto px-5 py-4">
            {/* 麦克风错误 */}
            {micError && (
              <div className="mb-3 rounded-2xl bg-red-50 p-3 text-xs text-red-600">
                {micError}
              </div>
            )}

            {/* 转写错误 */}
            {transcribeError && (
              <div className="mb-3 rounded-2xl bg-orange-50 p-3 text-xs text-orange-600">
                {transcribeError}
              </div>
            )}

            {/* idle 状态 */}
            {phase === "idle" && (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--soft-blue)]">
                  <Mic size={28} className="text-[var(--blue-deep)]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--ink)]">点击下方录音按钮开始练习</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    说话时语音会实时转写成文字，结束后生成 AI 评审报告
                  </p>
                </div>
              </div>
            )}

            {/* connecting 状态 */}
            {phase === "connecting" && (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <Loader2 size={32} className="animate-spin text-[var(--blue-deep)]" />
                <div>
                  <p className="text-sm font-bold text-[var(--ink)]">正在连接语音识别服务…</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    连接阿里云 Paraformer 实时转写引擎
                  </p>
                </div>
              </div>
            )}

            {/* live / paused / finishing 状态：显示转写文本 */}
            {(phase === "live" || phase === "paused" || phase === "finishing") && (
              <div className="flex h-full flex-col">
                {hasTranscript ? (
                  <div className="flex-1">
                    <p className="text-[15px] leading-[1.8] text-[var(--ink)] whitespace-pre-wrap">
                      {finalText}
                      {interimText && (
                        <span className="text-[var(--quiet)]">{interimText}</span>
                      )}
                      {phase === "live" && (
                        <span className="inline-block w-[2px] h-[18px] bg-[var(--blue)] ml-0.5 animate-pulse align-middle" />
                      )}
                    </p>
                    {phase === "live" && (
                      <div className="mt-4 flex items-center gap-2 text-xs text-[var(--blue-deep)]">
                        <div className="wave-bars-large" style={{ height: 20 }}>
                          <span /><span /><span /><span /><span /><span /><span />
                        </div>
                        <span>实时转写中</span>
                      </div>
                    )}
                    {phase === "paused" && (
                      <div className="mt-4 text-xs text-[var(--muted)]">
                        已暂停，点击继续恢复录音
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                    {phase === "live" ? (
                      <>
                        <div className="wave-bars-large">
                          <span /><span /><span /><span /><span /><span /><span />
                        </div>
                        <p className="text-sm text-[var(--muted)]">正在聆听…请开始说话</p>
                      </>
                    ) : phase === "paused" ? (
                      <>
                        <Pause size={28} className="text-[var(--muted)]" />
                        <p className="text-sm text-[var(--muted)]">已暂停</p>
                      </>
                    ) : (
                      <Loader2 size={28} className="animate-spin text-[var(--blue-deep)]" />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 结束确认 */}
      <AnimatePresence>
        {confirmEnd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur"
            onClick={() => setConfirmEnd(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-[380px] rounded-[28px] bg-white p-7 text-center"
              style={{ boxShadow: "var(--shadow)" }}
            >
              <h3 className="text-lg font-extrabold text-[var(--ink)]">结束这次练习？</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">
                结束后将生成 AI 评审报告，练习无法继续。
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setConfirmEnd(false)}
                  className="flex-1 rounded-full bg-[var(--soft)] py-3 text-sm font-bold text-[var(--ink)] transition-colors hover:bg-[var(--soft-blue)]"
                >
                  继续练习
                </button>
                <button
                  onClick={handleEnd}
                  className="flex-1 rounded-full py-3 text-sm font-bold text-white transition-transform active:scale-95"
                  style={{ background: "#e85a5a" }}
                >
                  确认结束
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
