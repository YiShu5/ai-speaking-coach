import { NextResponse } from "next/server";

// 验证码存储：用 httpOnly cookie 存（避免 dev 热重载丢失内存数据）
// cookie 格式: base64(phone:code:expireTimestamp)

const OTP_TTL_MS = 5 * 60 * 1000; // 5 分钟有效

function genCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(request: Request) {
  let body: { phone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const phone = (body.phone ?? "").replace(/\s/g, "");

  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return NextResponse.json({ error: "手机号格式不正确" }, { status: 400 });
  }

  const code = genCode();
  const expireAt = Date.now() + OTP_TTL_MS;
  const payload = Buffer.from(`${phone}:${code}:${expireAt}`).toString("base64");

  const res = NextResponse.json({
    success: true,
    // 开发模式直接返回验证码，前端显示提示；生产环境不返回
    devCode: process.env.NODE_ENV !== "production" ? code : undefined,
  });

  res.cookies.set("speakcoach_otp", payload, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: OTP_TTL_MS / 1000,
  });

  return res;
}
