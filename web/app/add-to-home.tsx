"use client";
import { useSyncExternalStore } from 'react';
import { historyServerSnapshot, historySnapshot, subscribeHistory } from '../lib/history';

/**
 * "添加到主屏幕"的引导。
 *
 * 加到主屏幕之后体验明显更好：有自己的图标、没有地址栏、麦克风权限只授一次。
 * 但用户不会自己发现这个功能，iOS 上还只有 Safari 能加。
 *
 * 两条克制的原则：
 * 1. **用过两次之后才出现**，不一进来就弹——第一次用的人还没觉得这东西值得留下
 * 2. 关掉就不再出现
 *
 * 没有做 Chrome 那个原生安装弹窗（beforeinstallprompt）：它要求站点有
 * Service Worker，我们没有，事件根本不会触发，写了也是死代码。安卓这边
 * 一样给文字步骤。
 */

type Hint = 'none' | 'ios' | 'android';

const DISMISS_KEY = 'oncue.a2hs.dismissed';

/** 同一份结果要返回同一个值，否则 React 会认为一直在变 */
let cached: Hint | null = null;
const listeners = new Set<() => void>();

function compute(): Hint {
  if (typeof window === 'undefined') return 'none';

  try {
    if (window.localStorage.getItem(DISMISS_KEY)) return 'none';
  } catch {
    // 读不到就当没关过，顶多多显示一次
  }

  // 已经是从主屏幕打开的，就不用再劝了
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return 'none';

  const ua = window.navigator.userAgent;

  // 微信、QQ 这类内置浏览器加不了主屏幕，别给用户指一条走不通的路
  if (/MicroMessenger|QQ\/|Weibo/i.test(ua)) return 'none';

  if (/iPhone|iPad|iPod/i.test(ua)) {
    // iOS 上只有 Safari 能加。Chrome、Firefox、Edge 的 iOS 版都不行
    return /CriOS|FxiOS|EdgiOS/i.test(ua) ? 'none' : 'ios';
  }
  if (/Android/i.test(ua)) return 'android';
  return 'none';
}

function snapshot(): Hint {
  cached ??= compute();
  return cached;
}

function serverSnapshot(): Hint {
  return 'none';
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function dismiss(): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // 记不住就算了，下次再关一次
  }
  cached = 'none';
  listeners.forEach(listener => listener());
}

/** 用过几次之后才提示 */
const MIN_LOOKUPS = 2;

export default function AddToHome() {
  const hint = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const { list } = useSyncExternalStore(subscribeHistory, historySnapshot, historyServerSnapshot);

  if (hint === 'none' || list.length < MIN_LOOKUPS) return null;

  const steps =
    hint === 'ios'
      ? '点底部的分享按钮，选「添加到主屏幕」。'
      : '点浏览器右上角的菜单，选「添加到主屏幕」或「安装应用」。';

  return (
    <section className="flex items-start gap-3 rounded-[14px] border border-line bg-fill-warm px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-[14px] font-medium">放到桌面上，下次一点就开</p>
        <p className="text-[13px] leading-[1.5] text-muted">{steps}麦克风权限也只用给一次。</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="不再提示"
        className="-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted active:bg-line-soft"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
        </svg>
      </button>
    </section>
  );
}
