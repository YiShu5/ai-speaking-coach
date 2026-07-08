"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { Toast } from "@/components/ui/Toast";

// 练习页与登录页不显示侧边栏
const FULLSCREEN = ["/practice", "/login"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullscreen = FULLSCREEN.some((p) => pathname.startsWith(p));

  return (
    <>
      <div className="aurora-bg">
        <div className="aurora-blob a" />
        <div className="aurora-blob b" />
        <div className="aurora-blob c" />
      </div>

      <div
        className="relative z-10 flex h-screen w-full"
        style={{
          gridTemplateColumns: fullscreen ? "1fr" : undefined,
        }}
      >
        {!fullscreen && <Sidebar />}
        <main className="min-w-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <Toast />
    </>
  );
}
