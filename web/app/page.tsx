import type { ReactNode } from 'react';
import SearchForm from './search-form';
import HomeSuggestions from './home-suggestions';
import AddToHome from './add-to-home';

const TIPS: { icon: ReactNode; title: string; desc: string }[] = [
  {
    icon: <span className="font-display text-[15px] font-semibold">Aa</span>,
    title: '打一个词',
    desc: '拼得不准也行，会猜你想查哪个',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h10" />
      </svg>
    ),
    title: '粘贴整句',
    desc: '先告诉你这个词在句子里是哪个意思',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 8V5a1 1 0 0 1 1-1h3" />
        <path d="M16 4h3a1 1 0 0 1 1 1v3" />
        <path d="M20 16v3a1 1 0 0 1-1 1h-3" />
        <path d="M8 20H5a1 1 0 0 1-1-1v-3" />
        <path d="M8 10h8" />
        <path d="M8 14h5" />
      </svg>
    ),
    title: '截图里的词',
    desc: '先用手机自带的文字识别把英文复制出来，再粘贴',
  },
];

export default function Page() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col gap-7 px-5 pt-7 pb-8">
      <header className="flex items-baseline gap-1.5">
        <span className="font-display text-2xl font-semibold tracking-[-0.3px]">OnCue</span>
        <span className="text-[15px] font-medium text-muted">单词</span>
      </header>

      <div className="mt-9 flex flex-col gap-2">
        <h1 className="text-[28px] leading-[1.3] font-bold">遇到生词，丢进来。</h1>
        <p className="text-[15px] leading-[1.6] text-muted">单词或整句都可以。给你意思、读音和例句，再读给它听——它告诉你读对了没有。</p>
      </div>

      {/*
        隐私提示贴着输入框放，不放页脚——它说的正是"你正要粘进去的东西会怎么样"，
        在那一刻看到才有用。目标用户会贴客户 RFP 和邮件原文，这句必须在。
        两件事要分开说清楚：粘贴的内容会外发，录音不保存。别混成"我们不保存你的数据"。
      */}
      <div className="flex flex-col gap-2.5">
        <SearchForm />
        <p className="px-1 text-[13px] leading-[1.6] text-muted">
          内容会发送到云端 AI 处理，别粘贴敏感或客户保密的信息。跟读录音只用于当次评测，评完即删。
        </p>
      </div>

      <HomeSuggestions />

      <AddToHome />

      <section aria-labelledby="tips-title" className="flex flex-col gap-3.5 px-1">
        <h2 id="tips-title" className="text-[13px] font-medium text-muted">怎么丢进来</h2>
        {TIPS.map(tip => (
          <div key={tip.title} className="flex items-start gap-3">
            <div aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-brand-tint text-brand">{tip.icon}</div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="text-[15px] font-medium">{tip.title}</div>
              <div className="text-[13px] leading-[1.5] text-muted">{tip.desc}</div>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
