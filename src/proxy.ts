import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next.js 16: proxy 替代 middleware
// 鉴权：未登录访问受保护路由 → 跳转登录
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 受保护路由
  const protectedRoutes = ["/", "/practice", "/report", "/records"];
  const isProtected = protectedRoutes.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  // 登录态通过 cookie 判断（mock 阶段用 localStorage，proxy 不拦截；
  // 接入 Supabase 后改为读取 sb-xxx auth cookie）
  const authCookie = request.cookies.get("speakcoach_auth");

  if (isProtected && !authCookie) {
    // mock 阶段不强制拦截，由前端 useUser 兜底跳转
    // 接入 Supabase 后启用：
    // const loginUrl = new URL("/login", request.url);
    // return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
