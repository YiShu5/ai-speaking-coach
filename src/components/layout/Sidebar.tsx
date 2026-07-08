"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, Clock, History, Settings } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { Avatar } from "@/components/ui/Avatar";

const NAV = [
  { href: "/", label: "开始", icon: Sparkles },
  { href: "/records", label: "记录", icon: History },
];

export function Sidebar() {
  const pathname = usePathname();
  const user = useAppStore((s) => s.user);

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

      {/* 个人资料 */}
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
        <button className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--soft-blue)]">
          <Settings size={16} />
        </button>
      </div>
    </aside>
  );
}
