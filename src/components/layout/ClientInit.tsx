"use client";

import { useEffect } from "react";
import { useAppStore } from "@/stores/app-store";

// 客户端初始化：从 localStorage 恢复用户态
export function ClientInit({ children }: { children: React.ReactNode }) {
  const initUser = useAppStore((s) => s.initUser);
  useEffect(() => {
    initUser();
  }, [initUser]);
  return <>{children}</>;
}
