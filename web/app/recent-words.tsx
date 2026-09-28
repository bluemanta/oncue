"use client";
import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { clearLookups, historyServerSnapshot, historySnapshot, subscribeHistory } from '../lib/history';

/** 首页最多露出这么多，再多就把首页撑长了，违背"只有两个动作"的原则 */
const SHOWN = 12;

/**
 * 最近查过。
 *
 * 记录只在这台手机上（见 lib/history.ts），所以界面上必须把这件事说清楚，
 * 否则用户会当成云端收藏夹，换手机时才发现全没了。
 */
export default function RecentWords() {
  const { list } = useSyncExternalStore(subscribeHistory, historySnapshot, historyServerSnapshot);

  if (list.length === 0) return null;

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
