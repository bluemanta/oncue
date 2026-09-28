/**
 * 查词记录（PRD F6）。
 *
 * **只存在用户自己的手机上**，用浏览器的 localStorage，不上云、不进数据库。
 * 这是刻意选的：产品的定位是"遇到的那一秒解决掉"，注册登录跟定位打架；
 * 而且不上云就没有隐私负担——用户粘进来的可能是客户材料。
 *
 * 代价也要说清楚：换手机、换浏览器、清缓存都会丢，iOS 对长期不访问的网站
 * 还会主动清理。所以界面上必须如实告诉用户，别让人当收藏夹用
 * （见 app/recent-words.tsx 底部那句话）。
 *
 * 什么时候该换成云端存储，见 Linear IFM-204。
 *
 * 这里做成一个"外部数据源"（subscribe + snapshot）而不是普通函数，
 * 是为了配合 React 的 useSyncExternalStore：localStorage 在服务端不存在，
 * 直接读会让两边渲染结果对不上，这套写法能让它在挂载之后才出现。
 */

export type LookupRecord = {
  word: string;
  /** 用户当时输入的原文。点"最近查过"时按原样重查，语境义才对得上 */
  query: string;
  /** 毫秒时间戳 */
  at: number;
};

export type HistoryState = {
  list: LookupRecord[];
  /** 刚记下的这次查词，上一次是哪天（同一天不算）。给结果页显示"你某天查过" */
  seenBefore: { word: string; day: string } | null;
};

const KEY = 'oncue.history.v1';

/** 最多留多少条。手机上一屏展示不了太多，留太多也没人翻 */
const MAX = 30;

/** 服务端渲染时固定用这个：没有 localStorage，也不能假装有 */
const SERVER_STATE: HistoryState = { list: [], seenBefore: null };

/**
 * localStorage 不是永远可用的：Safari 隐私模式、用户禁用存储、配额满了
 * 都会抛异常。记录丢了不是大事，绝不能因此让整张卡片崩掉，所以一律吞掉异常。
 */
function safeRead(): LookupRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is LookupRecord =>
        typeof item === 'object' && item !== null &&
        typeof (item as LookupRecord).word === 'string' &&
        typeof (item as LookupRecord).query === 'string' &&
        typeof (item as LookupRecord).at === 'number',
    );
  } catch {
    return [];
  }
}

function safeWrite(list: LookupRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // 写不进去就算了，不打扰用户
  }
}

let state: HistoryState | null = null;
const listeners = new Set<() => void>();

function publish(next: HistoryState): void {
  state = next;
  listeners.forEach(listener => listener());
}

export function subscribeHistory(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** 同一份数据要返回同一个对象，否则 React 会认为一直在变、无限重渲 */
export function historySnapshot(): HistoryState {
  state ??= { list: safeRead(), seenBefore: null };
  return state;
}

export function historyServerSnapshot(): HistoryState {
  return SERVER_STATE;
}

/** 按北京时间取"哪一天"，用来判断是不是同一天 */
function dayOf(at: number): string {
  return new Date(at + 8 * 3600_000).toISOString().slice(0, 10);
}

const normalize = (word: string) => word.trim().toLowerCase();

/**
 * 记一次查词。
 *
 * 顺带算出"上一次查这个词是哪天"，只在上次是**别的日子**时才算数——
 * "你今天查过"没有信息量。按天判断还顺手绕开了一个坑：开发模式下
 * React 会把 effect 跑两次，第二次读到的就是刚写进去的今天这条。
 * 同一个词重复调用时保留上一次算出的结果，正是为了这个。
 */
export function recordLookup(word: string, query: string): void {
  const now = Date.now();
  const key = normalize(word);
  const list = historySnapshot().list;
  const previous = list.find(item => normalize(item.word) === key) ?? null;
  const nextList = [{ word, query, at: now }, ...list.filter(item => normalize(item.word) !== key)].slice(0, MAX);
  safeWrite(nextList);

  const earlierDay = previous && dayOf(previous.at) !== dayOf(now) ? formatDay(previous.at) : null;
  const keptSeen = state?.seenBefore && normalize(state.seenBefore.word) === key ? state.seenBefore : null;

  publish({ list: nextList, seenBefore: earlierDay ? { word, day: earlierDay } : keptSeen });
}

export function clearLookups(): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      // 同上
    }
  }
  publish({ list: [], seenBefore: null });
}

/** "9月20日"。同一年不显示年份，跨年了才显示 */
export function formatDay(at: number): string {
  const date = new Date(at);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  return year === new Date().getFullYear() ? `${month}月${day}日` : `${year}年${month}月${day}日`;
}
