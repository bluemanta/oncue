"use client";
import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { clearLookups, historyServerSnapshot, historySnapshot, subscribeHistory } from '../lib/history';

/** 首页最多露出这么多，再多就把首页撑长了，违背"只有两个动作"的原则 */
const SHOWN = 12;

/** 新用户的第一个词。选 schedule 是因为它够常见，而且十个人有九个读错开头那个音 */
const EXAMPLE = "Let's check my schedule for next week.";

/**
 * 首页输入框下面那一块。
 *
 * 两种状态共用一个位置，互斥：
 * - 没查过词（新用户）→ 给一个能直接点的例子
 * - 查过词 → 显示"最近查过"
 *
 * 之所以写在一个组件里，是因为它们本来就抢同一块地方，分开写要么打架
 * 要么得在外面再判断一次"有没有记录"，而那个判断只有客户端知道。
 */
export default function HomeSuggestions() {
  const { list } = useSyncExternalStore(subscribeHistory, historySnapshot, historyServerSnapshot);

  if (list.length === 0) {
    return (
      <section aria-labelledby="example-title" className="flex flex-col gap-2.5 px-1">
        <h2 id="example-title" className="text-[13px] font-medium text-muted">第一次用？点这句试试</h2>
        <Link
          href={`/result?q=${encodeURIComponent(EXAMPLE)}`}
          className="flex items-center gap-3 rounded-[14px] border border-line bg-card px-4 py-3 active:bg-fill"
        >
          <span className="min-w-0 flex-1 font-latin text-[15px] leading-[1.5] text-ink-soft">{EXAMPLE}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-brand">
            <path d="M5 12h14" />
            <path d="M13 6l6 6-6 6" />
          </svg>
        </Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="recent-title" className="flex flex-col gap-3 px-1">
      <div className="flex items-baseline gap-3">
        <h2 id="recent-title" className="text-[13px] font-medium text-muted">最近查过</h2>
        <button
          type="button"
          onClick={clearLookups}
          className="ml-auto text-[13px] text-muted underline underline-offset-2 active:text-ink"
        >
          清空
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {list.slice(0, SHOWN).map(item => (
          <Link
            key={item.word + item.at}
            href={`/result?q=${encodeURIComponent(item.query)}`}
            className="flex h-9 items-center rounded-full border border-line-strong bg-card px-3.5 font-latin text-[15px] text-ink active:bg-fill"
          >
            {item.word}
          </Link>
        ))}
      </div>

      <p className="text-[13px] leading-[1.6] text-muted">
        这些记录只存在这台手机上，换手机或者清理浏览器数据就没了。别把它当收藏夹——趁还在，早点把这些词读熟。
      </p>
    </section>
  );
}
