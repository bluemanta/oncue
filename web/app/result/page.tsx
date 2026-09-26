import Link from 'next/link';

export default async function ResultPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = q?.trim() ?? '';

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col gap-4 px-5 pt-5 pb-8">
      <div className="flex h-11 items-center">
        <Link href="/" className="flex h-11 items-center gap-1 pr-3 text-[15px] text-ink">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          <span>返回</span>
        </Link>
      </div>

      {query ? (
        <div className="rounded-xl bg-fill-warm px-3.5 py-3 text-[14px] leading-[1.6] text-ink-soft">
          <span className="mr-1.5 text-xs font-medium text-muted">你输入的</span>
          {query}
        </div>
      ) : (
        <p className="text-[15px] leading-[1.6] text-muted">没有收到要查的内容，回上一页再试一次。</p>
      )}

      <div className="flex flex-col gap-1.5 rounded-[20px] border border-dashed border-line bg-card p-5">
        <div className="text-[15px] font-medium">结果卡片还没做</div>
        <p className="text-[13px] leading-[1.6] text-muted">下一步在这里放释义、音标、易错点、例句和跟读入口。现在这一页只用来确认首页的输入有没有正确传过来。</p>
      </div>
    </main>
  );
}
