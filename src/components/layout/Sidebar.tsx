"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, History, Settings, User, LogOut } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { Avatar } from "@/components/ui/Avatar";
import { ProfileDialog } from "@/components/ui/ProfileDialog";
import { logout } from "@/lib/mock-api";

const NAV = [
  { href: "/", label: "开始", icon: Sparkles },
  { href: "/records", label: "记录", icon: History },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const showToast = useAppStore((s) => s.showToast);

  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  function handleLogout() {
    setMenuOpen(false);
    showToast("正在退出登录…");
    logout();
    setUser(null);
    setTimeout(() => {
      router.push("/login");
    }, 400);
  }

  function handleProfile() {
    setMenuOpen(false);
    setProfileOpen(true);
  }

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col gap-6 p-6">
      {/* 品牌 */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-black text-white"
          style={{
            background: "linear-gradient(135deg, var(--blue), var(--lavender))",
            boxShadow: "0 8px 20px rgba(117,169,255,0.35)",
          }}
        >
          SC
        </div>
        <div>
          <div className="text-[17px] font-extrabold leading-tight text-[var(--ink)]">
            SpeakCoach
          </div>
          <div className="text-xs text-[var(--muted)]">AI 演讲陪练</div>
        </div>
      </div>

      {/* 导航 */}
      <nav className="flex flex-col gap-2">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/" || pathname === "/practice" || pathname.startsWith("/report")
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group relative flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors"
              style={{
                background: active ? "linear-gradient(135deg, var(--blue), var(--lavender))" : "transparent",
                color: active ? "#fff" : "var(--ink)",
              }}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full transition-colors"
                style={{
                  background: active ? "rgba(255,255,255,0.25)" : "var(--soft-blue)",
                  color: active ? "#fff" : "var(--blue-deep)",
                }}
              >
                <Icon size={18} strokeWidth={2.2} />
              </span>
              <span className="text-[15px] font-bold">{item.label}</span>
              {active && (
                <motion.span
                  layoutId="nav-indicator"
                  className="absolute right-3 h-1.5 w-1.5 rounded-full bg-white"
                />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      {/* 个人资料 + 设置下拉菜单 */}
      <div className="relative" ref={menuRef}>
        {/* 下拉菜单（按钮上方） */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-2xl bg-[var(--paper-solid)]"
              style={{ border: "1px solid var(--line)", boxShadow: "var(--shadow)" }}
            >
              <button
                onClick={handleProfile}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--soft-blue)]"
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white"
                  style={{ background: "linear-gradient(135deg, var(--blue), var(--lavender))" }}
                >
                  <User size={14} />
                </div>
                <span className="text-sm font-bold text-[var(--ink)]">个人资料</span>
              </button>
              <div className="h-px bg-[var(--line)]" />
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#fef2f2]"
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white"
                  style={{ background: "linear-gradient(135deg, #ef4444, #f97316)" }}
                >
                  <LogOut size={14} />
                </div>
                <span className="text-sm font-bold text-[#dc2626]">退出登录</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 个人资料条 */}
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-3">
          <Avatar char={user?.displayName?.[0] ?? "练"} size={40} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-[var(--ink)]">
              {user?.displayName ?? "练习者"}
            </div>
            <div className="truncate text-xs text-[var(--muted)]">
              {user?.phone ?? "未登录"}
            </div>
          </div>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--soft-blue)]"
            aria-label="设置"
            aria-expanded={menuOpen}
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* 个人资料弹窗（修改姓名） */}
      <ProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
    </aside>
  );
}
