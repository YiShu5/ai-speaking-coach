"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Phone, ShieldCheck, Loader2 } from "lucide-react";
import { sendOtp, verifyOtp } from "@/lib/mock-api";
import { useAppStore } from "@/stores/app-store";

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAppStore((s) => s.setUser);
  const showToast = useAppStore((s) => s.showToast);

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);

  async function handleSendCode() {
    const cleaned = phone.replace(/\s/g, "");
    if (!/^1[3-9]\d{9}$/.test(cleaned)) {
      showToast("手机号格式不正确");
      return;
    }
    setLoading(true);
    const res = await sendOtp(cleaned);
    setLoading(false);
    if (res.success) {
      setStep("code");
      setCooldown(60);
      if (res.devCode) {
        setDevCode(res.devCode);
      }
      const t = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) {
            clearInterval(t);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
      showToast(res.devCode ? `验证码已发送（开发模式：${res.devCode}）` : "验证码已发送");
    } else {
      showToast(res.error ?? "发送失败");
    }
  }

  async function handleVerify() {
    if (code.length !== 6) {
      showToast("请输入 6 位验证码");
      return;
    }
    setLoading(true);
    const res = await verifyOtp(phone.replace(/\s/g, ""), code);
    setLoading(false);
    if (res.user) {
      setUser(res.user);
      showToast("登录成功");
      router.push("/");
    } else {
      showToast(res.error ?? "验证失败");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[420px]"
      >
        {/* 品牌 */}
        <div className="mb-10 text-center">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-2xl font-black text-white"
            style={{
              background: "linear-gradient(135deg, var(--blue), var(--lavender))",
              boxShadow: "0 12px 30px rgba(117,169,255,0.4)",
            }}
          >
            SC
          </motion.div>
          <h1 className="text-2xl font-extrabold text-[var(--ink)]">SpeakCoach</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">AI 演讲陪练 · 登录开始练习</p>
        </div>

        {/* 表单卡 */}
        <div
          className="rounded-[28px] border border-[var(--line)] bg-[var(--paper-solid)] p-8"
          style={{ boxShadow: "var(--shadow)" }}
        >
          {step === "phone" ? (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                手机号
              </label>
              <div className="relative">
                <Phone
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--quiet)]"
                />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="请输入手机号"
                  className="w-full rounded-2xl border border-[var(--line)] bg-[var(--soft)] py-3.5 pl-11 pr-4 text-[15px] outline-none transition-all focus:border-[var(--blue)] focus:bg-white focus:ring-4 focus:ring-[var(--blue)]/15"
                />
              </div>
              <button
                onClick={handleSendCode}
                disabled={loading}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[15px] font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg, var(--blue), var(--lavender))",
                  boxShadow: "var(--btn-shadow)",
                }}
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  "获取验证码"
                )}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="code"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <button
                onClick={() => setStep("phone")}
                className="mb-4 flex items-center gap-1 text-xs text-[var(--muted)] transition-colors hover:text-[var(--blue-deep)]"
              >
                <ArrowLeft size={14} /> 返回
              </button>
              {devCode && (
                <div className="mb-4 rounded-2xl border border-[var(--blue)]/30 bg-[var(--soft-blue)] px-4 py-3 text-sm">
                  <span className="font-bold text-[var(--blue-deep)]">开发模式验证码：</span>
                  <span className="ml-1 font-mono text-lg font-black tracking-[0.2em] text-[var(--blue-deep)]">
                    {devCode}
                  </span>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    本地开发环境不发送真实短信，直接使用上方验证码登录
                  </p>
                </div>
              )}
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                验证码
              </label>
              <div className="relative">
                <ShieldCheck
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--quiet)]"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="6 位验证码"
                  className="w-full rounded-2xl border border-[var(--line)] bg-[var(--soft)] py-3.5 pl-11 pr-4 text-lg tracking-[0.3em] outline-none transition-all focus:border-[var(--blue)] focus:bg-white focus:ring-4 focus:ring-[var(--blue)]/15"
                />
              </div>
              <button
                onClick={handleVerify}
                disabled={loading || code.length !== 6}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[15px] font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, var(--blue), var(--lavender))",
                  boxShadow: "var(--btn-shadow)",
                }}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : "登录"}
              </button>
              <button
                onClick={handleSendCode}
                disabled={cooldown > 0}
                className="mt-3 w-full text-center text-xs text-[var(--muted)] transition-colors hover:text-[var(--blue-deep)] disabled:opacity-50"
              >
                {cooldown > 0 ? `重新发送 (${cooldown}s)` : "重新发送验证码"}
              </button>
              <p className="mt-4 text-center text-xs text-[var(--quiet)]">
                验证码将发送至 {phone}
              </p>
            </motion.div>
          )}
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-[var(--quiet)]">
          登录即表示同意 SpeakCoach 服务条款与隐私政策
          <br />
          演讲内容仅用于本次练习反馈，不向第三方共享
        </p>
      </motion.div>
    </div>
  );
}
