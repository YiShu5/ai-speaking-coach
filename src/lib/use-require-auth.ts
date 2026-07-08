"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/stores/app-store";

// 鉴权 hook：未登录跳转登录页
export function useRequireAuth() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const initUser = useAppStore((s) => s.initUser);

  useEffect(() => {
    initUser();
    const u = useAppStore.getState().user;
    if (!u) {
      router.replace("/login");
    }
  }, [router, initUser]);

  return user;
}
