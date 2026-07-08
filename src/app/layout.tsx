import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { ClientInit } from "@/components/layout/ClientInit";

export const metadata: Metadata = {
  title: "SpeakCoach - AI 演讲陪练",
  description:
    "上传文稿，和 6 位虚拟评审一起完成一次接近真实会议的表达训练，获得多维度评分与逐句优化建议。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="h-full">
        <ClientInit>
          <AppShell>{children}</AppShell>
        </ClientInit>
      </body>
    </html>
  );
}
