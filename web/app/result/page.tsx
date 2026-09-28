import Link from 'next/link';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getCardProvider } from '../../lib/providers';
import { checkQuota, clientIp, countQuota, QUOTA_MESSAGE } from '../../lib/quota';
import CardView from './card-view';

/**
 * 不让搜索引擎收录结果页。
 *
 * 这个地址每被打开一次就是一次大模型调用，被爬虫抓等于替我们花钱。
 * robots.txt 里也禁了（见 app/robots.ts），这里是第二道。
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: ReactNode }) {
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
      {children}
    </main>
  );
}

export default async function ResultPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = q?.trim() ?? '';

  if (!query) {
    return (
      <Shell>
        <p className="text-[15px] leading-[1.6] text-muted">没有收到要查的内容，回上一页再试一次。</p>
      </Shell>
    );
  }

  // 每日上限：这个地址是开放的 GET，不设闸就等于让人替我们花钱
  const ip = clientIp(await headers());
  const quota = checkQuota('card', ip);
  if (!quota.ok) {
    return (
      <Shell>
        <div className="flex flex-col gap-1.5 rounded-[20px] border border-line bg-card p-5">
          <p className="text-[15px] font-medium">{QUOTA_MESSAGE[quota.scope]}</p>
          <p className="text-[13px] leading-[1.6] text-muted">已经查过的词还能继续听读音和跟读。</p>
        </div>
      </Shell>
    );
  }

  const provider = getCardProvider();
  // 手写样本不花钱，不占额度
  if (provider.name !== 'sample') countQuota('card', ip);
  const result = await provider.generateCard(query);

  if (!result.ok) {
    return (
      <Shell>
        <div className="flex flex-col gap-1.5 rounded-[20px] border border-line bg-card p-5">
          <p className="text-[15px] font-medium">{result.message}</p>
          <p className="text-[13px] leading-[1.6] text-muted">换一个词或者把整句一起贴进来再试。</p>
        </div>
      </Shell>
    );
  }

  return <CardView card={result.card} sample={provider.name === 'sample'} query={query} />;
}
