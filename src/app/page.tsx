"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Upload, Check, ChevronRight, Loader2, FileCheck2 } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { REVIEWERS } from "@/lib/reviewers";
import { Avatar } from "@/components/ui/Avatar";
import { createPractice } from "@/lib/mock-api";
import { useRequireAuth } from "@/lib/use-require-auth";
import type { PracticeMode } from "@/types";

const MODES: { id: PracticeMode; title: string; desc: string }[] = [
  { id: "5min", title: "5分钟快速汇报", desc: "适合周会更新、项目进展、面试自我介绍" },
  { id: "10min", title: "10分钟演讲", desc: "适合方案汇报、答辩陈述、路演 Pitch" },
];

const ACCEPTED = [".txt", ".md", ".pdf", ".ppt", ".pptx", ".doc", ".docx"];

export default function StartPage() {
  useRequireAuth();
  const router = useRouter();
  const { mode, setMode, fileName, fileContent, setFile, clearFile, setPracticeId, showToast } =
    useAppStore();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [starting, setStarting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (file.size > 20 * 1024 * 1024) {
      showToast("文件太大了，换个 20MB 以内的文件吧");
      return;
    }
    const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
    if (!ACCEPTED.includes(ext)) {
      showToast("暂时只支持 TXT / MD / PDF / PPT / Word 文件");
      return;
    }
    setUploading(true);
    // 读取文件内容（txt/md 直接读，其他格式取文件名作为占位，后续接解析库）
    let content = "";
    if (ext === ".txt" || ext === ".md") {
      content = await file.text();
    } else {
      // mock：非文本格式用文件名模拟内容
      content = `【文稿：${file.name}】\n\n这是从 ${file.name} 提取的文稿内容。接入 pdf.js / mammoth.js 后将解析真实内容。`;
    }
    setFile(file.name, content);
    setUploading(false);
    showToast("文稿已就绪");
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  async function handleStart() {
    if (!fileContent) return;
    setStarting(true);
    const res = await createPractice(mode, fileName, fileContent);
    setPracticeId(res.id);
    setStarting(false);
    router.push("/practice");
  }

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08 } },
  };
  const item = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
  };

  return (
    <div className="scroll-soft h-full overflow-y-auto">
      <div className="mx-auto max-w-[1180px] px-10 py-12">
        <motion.div variants={container} initial="hidden" animate="show">
          {/* 主视觉 */}
          <motion.div variants={item} className="mb-10">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[var(--blue-deep)]">
              Presentation rehearsal room
            </div>
            <h1
              className="font-black leading-[1.1] text-[var(--ink)]"
              style={{ fontSize: "clamp(36px, 4.8vw, 62px)" }}
            >
              进入一场<span className="gradient-text">有反馈</span>的演讲练习
            </h1>
            <p className="mt-4 max-w-[640px] text-[17px] leading-relaxed text-[var(--muted)]">
              上传文稿，选择训练时长，和 6 位虚拟评审一起完成一次接近真实会议的表达训练。
            </p>
          </motion.div>

          {/* 双栏 */}
          <div
            className="grid gap-6"
            style={{ gridTemplateColumns: "minmax(0, 1.58fr) minmax(240px, 0.42fr)" }}
          >
            {/* 左：练习面板 */}
            <motion.div
              variants={item}
              className="rounded-[28px] p-8"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.9), rgba(246,250,255,0.84))",
                boxShadow: "var(--panel-shadow)",
                border: "1px solid var(--line)",
              }}
            >
              {/* 01 模式选择 */}
              <div className="mb-6 flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--blue-deep)] text-xs font-bold text-white">
                  01
                </span>
                <h2 className="text-lg font-extrabold text-[var(--ink)]">选择训练模式</h2>
              </div>

              <div className="mb-8 grid grid-cols-2 gap-4">
                {MODES.map((m) => {
                  const active = mode === m.id;
                  return (
                    <motion.button
                      key={m.id}
                      onClick={() => setMode(m.id)}
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 0.98 }}
                      className="relative overflow-hidden rounded-3xl p-5 text-left transition-all"
                      style={{
                        background: active
                          ? "linear-gradient(135deg, rgba(234,243,255,0.94), rgba(241,236,255,0.86))"
                          : "var(--paper-solid)",
                        border: active
                          ? "1.5px solid rgba(117,169,255,0.52)"
                          : "1.5px solid var(--line)",
                        boxShadow: active ? "0 12px 28px rgba(117,169,255,0.18)" : "none",
                      }}
                    >
                      {active && (
                        <motion.span
                          initial={{ scale: 0, rotate: -90 }}
                          animate={{ scale: 1, rotate: 0 }}
                          className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full text-white"
                          style={{
                            background: "linear-gradient(135deg, var(--blue), var(--lavender))",
                          }}
                        >
                          <Check size={14} strokeWidth={3} />
                        </motion.span>
                      )}
                      <div className="mb-1 text-[15px] font-extrabold text-[var(--ink)]">
                        {m.title}
                      </div>
                      <div className="text-xs leading-relaxed text-[var(--muted)]">{m.desc}</div>
                    </motion.button>
                  );
                })}
              </div>

              {/* 02 上传文稿 */}
              <div className="mb-6 flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--blue-deep)] text-xs font-bold text-white">
                  02
                </span>
                <h2 className="text-lg font-extrabold text-[var(--ink)]">上传文稿</h2>
              </div>

              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED.join(",")}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />

              <motion.div
                onClick={() => !uploading && inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                whileHover={{ scale: fileContent ? 1 : 1.005 }}
                className="cursor-pointer rounded-3xl p-8 text-center transition-all"
                style={{
                  background: fileContent
                    ? "linear-gradient(135deg, rgba(234,243,255,0.92), rgba(255,231,201,0.54))"
                    : dragOver
                    ? "var(--soft-blue)"
                    : "var(--soft)",
                  border: fileContent
                    ? "1.5px solid rgba(117,169,255,0.5)"
                    : dragOver
                    ? "1.5px dashed var(--blue)"
                    : "1.5px dashed var(--line)",
                }}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-3 py-2">
                    <Loader2 size={32} className="animate-spin text-[var(--blue-deep)]" />
                    <span className="text-sm text-[var(--muted)]">上传中…</span>
                  </div>
                ) : fileContent ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-full text-white"
                      style={{
                        background: "linear-gradient(135deg, var(--blue), var(--lavender))",
                      }}
                    >
                      <FileCheck2 size={26} />
                    </div>
                    <div className="max-w-full truncate text-[15px] font-bold text-[var(--ink)]">
                      {fileName}
                    </div>
                    <div className="text-xs text-[var(--muted)]">文稿已就绪，可以开始练习</div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearFile();
                      }}
                      className="mt-1 text-xs text-[var(--quiet)] underline transition-colors hover:text-[var(--blue-deep)]"
                    >
                      重新上传
                    </button>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-2">
                    <motion.div
                      animate={{ y: dragOver ? -4 : 0 }}
                      className="flex h-14 w-14 items-center justify-center rounded-full text-white"
                      style={{
                        background: "linear-gradient(135deg, var(--blue), var(--lavender))",
                        boxShadow: "0 8px 20px rgba(117,169,255,0.3)",
                      }}
                    >
                      <Upload size={24} />
                    </motion.div>
                    <div className="text-[15px] font-bold text-[var(--ink)]">
                      拖拽或点击上传 PPT、PDF、Word、TXT
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      必须上传文稿后才能开始练习
                    </div>
                  </div>
                )}
              </motion.div>

              {/* 开始练习 */}
              <motion.button
                onClick={handleStart}
                disabled={!fileContent || starting}
                whileHover={fileContent && !starting ? { scale: 1.01 } : {}}
                whileTap={fileContent && !starting ? { scale: 0.99 } : {}}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-full py-4 text-[16px] font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: fileContent
                    ? "linear-gradient(135deg, var(--blue), var(--lavender))"
                    : "var(--soft)",
                  color: fileContent ? "#fff" : "var(--quiet)",
                  boxShadow: fileContent ? "var(--btn-shadow)" : "none",
                  minHeight: 58,
                }}
              >
                {starting ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    开始练习
                    <ChevronRight size={20} />
                  </>
                )}
              </motion.button>
            </motion.div>

            {/* 右：评审席预览 */}
            <motion.div variants={item}>
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--blue-deep)] text-xs font-bold text-white">
                  03
                </span>
                <h2 className="text-lg font-extrabold text-[var(--ink)]">今日评审席</h2>
              </div>

              <div
                className="rounded-[28px] p-5"
                style={{
                  background: "var(--paper-solid)",
                  border: "1px solid var(--line)",
                  boxShadow: "var(--soft-shadow)",
                }}
              >
                <div className="flex flex-col gap-3">
                  {REVIEWERS.map((r, i) => (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.06, type: "spring", stiffness: 200 }}
                      className="flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-[var(--soft)]"
                    >
                      <Avatar char={r.avatarChar} size={44} />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[var(--ink)]">{r.name}</div>
                        <div className="truncate text-xs text-[var(--muted)]">{r.role}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl bg-[var(--lavender-soft)] p-3 text-center text-xs leading-relaxed text-[var(--blue-deep)]">
                  练习结束后，他们会从不同角度给你温和建议。
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
