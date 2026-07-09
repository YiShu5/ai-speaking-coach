"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Check } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { updateDisplayName } from "@/lib/mock-api";

export function ProfileDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const showToast = useAppStore((s) => s.showToast);

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(user?.displayName ?? "");
      setSaving(false);
    }
  }, [open, user]);

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      showToast("姓名不能为空");
      return;
    }
    if (trimmed === user?.displayName) {
      onClose();
      return;
    }
    setSaving(true);
    const updated = updateDisplayName(trimmed);
    if (updated) {
      setUser(updated);
      showToast("姓名已更新");
      onClose();
    } else {
      showToast("保存失败，请重试");
    }
    setSaving(false);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: "rgba(20,20,40,0.45)", backdropFilter: "blur(6px)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="w-[400px] overflow-hidden rounded-[28px] bg-[var(--paper-solid)]"
            style={{ border: "1px solid var(--line)", boxShadow: "var(--shadow)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h2 className="text-base font-extrabold text-[var(--ink)]">个人资料</h2>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--soft-blue)]"
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>

            {/* 内容 */}
            <div className="px-6 pb-6">
              {/* 手机号（只读） */}
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-bold text-[var(--muted)]">
                  手机号
                </label>
                <div
                  className="rounded-2xl bg-[var(--soft)] px-4 py-3 text-sm text-[var(--quiet)]"
                  style={{ border: "1px solid var(--line)" }}
                >
                  {user?.phone ?? "未绑定"}
                </div>
              </div>

              {/* 姓名（可编辑） */}
              <div className="mb-6">
                <label className="mb-1.5 block text-xs font-bold text-[var(--muted)]">
                  姓名
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={20}
                  placeholder="请输入姓名"
                  className="w-full rounded-2xl px-4 py-3 text-sm font-bold text-[var(--ink)] outline-none transition-colors focus:border-[var(--blue)]"
                  style={{
                    border: "1px solid var(--line)",
                    background: "var(--paper-solid)",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave();
                  }}
                  autoFocus
                />
              </div>

              {/* 保存按钮 */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white transition-opacity disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, var(--blue), var(--lavender))" }}
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                保存
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
