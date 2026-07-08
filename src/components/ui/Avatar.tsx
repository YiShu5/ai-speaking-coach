// 评审头像：圆形渐变 + 中文字符
export function Avatar({
  char,
  size = 44,
  active = false,
}: {
  char: string;
  size?: number;
  active?: boolean;
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: "linear-gradient(135deg, var(--blue), var(--lavender))",
        boxShadow: active
          ? "0 0 0 3px rgba(255,255,255,0.8), 0 8px 20px rgba(117,169,255,0.4)"
          : "0 6px 16px rgba(117,169,255,0.28)",
      }}
    >
      {char}
    </div>
  );
}
