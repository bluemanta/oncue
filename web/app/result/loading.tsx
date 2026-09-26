/**
 * 等结果卡片生成时显示的骨架屏。
 *
 * 大模型出一张卡片要 3–4 秒，这几秒里不能让页面一片空白——用和真卡片
 * 一样的形状占位，让用户看出"内容正在来"，而不是"点了没反应"。
 */
function Bar({ className = '' }: { className?: string }) {
  return <div className={`rounded bg-line ${className}`} />;
}

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col gap-4 px-5 pt-5 pb-8">
      <div className="flex h-11 items-center">
        <span className="text-[15px] text-muted">返回</span>
      </div>

      <div className="animate-pulse space-y-4">
        <div className="rounded-xl bg-fill-warm px-3.5 py-3">
          <Bar className="h-3.5 w-4/5" />
        </div>

        <div className="flex flex-col gap-3 rounded-[20px] border border-line bg-card p-5">
          <Bar className="h-9 w-1/2" />
          <Bar className="h-4 w-2/3" />
          <div className="mt-1.5 flex gap-2.5">
            <Bar className="h-11 flex-1" />
            <Bar className="h-11 flex-1" />
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-2xl bg-brand-tint p-4">
          <Bar className="h-3 w-20" />
          <Bar className="h-4 w-full" />
          <Bar className="h-4 w-3/4" />
        </div>

        <div className="flex flex-col gap-3 rounded-[20px] border border-line bg-card px-5 py-[18px]">
          <Bar className="h-3 w-12" />
          <Bar className="h-4 w-11/12" />
          <Bar className="h-4 w-2/3" />
          <div className="h-px bg-line-soft" />
          <Bar className="h-3 w-12" />
          <Bar className="h-4 w-full" />
        </div>
      </div>

      <p role="status" className="text-center text-[13px] text-muted">正在查，大约几秒钟…</p>
    </main>
  );
}
