import { NextResponse } from "next/server";

// 校验验证码：读取 cookie 中的 otp，比对 phone + code + 过期时间
// 成功后设置登录态 cookie speakcoach_auth

export async function POST(request: Request) {
  let body: { phone?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const phone = (body.phone ?? "").replace(/\s/g, "");
  const code = (body.code ?? "").trim();

  if (!phone || !code) {
    return NextResponse.json({ error: "手机号和验证码不能为空" }, { status: 400 });
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const otpCookie = cookieHeader
    .split("; ")
    .find((c) => c.startsWith("speakcoach_otp="))
    ?.split("=")[1];

  if (!otpCookie) {
    return NextResponse.json({ error: "验证码已过期，请重新获取" }, { status: 400 });
  }

  let decoded: string;
  try {
    decoded = Buffer.from(otpCookie, "base64").toString("utf-8");
  } catch {
    return NextResponse.json({ error: "验证码无效" }, { status: 400 });
  }

  const [storedPhone, storedCode, expireStr] = decoded.split(":");
  const expireAt = Number(expireStr);

  if (Date.now() > expireAt) {
    return NextResponse.json({ error: "验证码已过期，请重新获取" }, { status: 400 });
  }

  if (storedPhone !== phone || storedCode !== code) {
    return NextResponse.json({ error: "验证码错误" }, { status: 400 });
  }

  // 校验通过，设置登录态
  const user = {
    id: `u_${Date.now()}`,
    phone,
    displayName: "练习者",
  };

  const res = NextResponse.json({ success: true, user });
  res.cookies.set("speakcoach_auth", JSON.stringify(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 3600, // 7 天
  });
  res.cookies.delete("speakcoach_otp");

  return res;
}
