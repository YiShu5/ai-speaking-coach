"use client";

import { useAppStore } from "@/stores/app-store";
import { AnimatePresence, motion } from "framer-motion";

export function Toast() {
  const toast = useAppStore((s) => s.toast);
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast}
          initial={{ opacity: 0, y: -16, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: -16, x: "-50%" }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="fixed top-6 left-1/2 z-[200] rounded-full bg-[var(--ink)]/90 px-5 py-2.5 text-sm text-white shadow-lg backdrop-blur"
        >
          {toast}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
