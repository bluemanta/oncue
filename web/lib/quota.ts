/**
 * 每日调用上限——花钱的最后一道闸。
 *
 * 为什么需要它：`/result?q=…` 是普通 GET 地址，每打开一次就是一次大模型调用；
 * `/api/speech`、`/api/assess` 也是开放接口，没有登录。Nginx 那层挡的是
 * "一分钟内太密集"，挡不住"一整天慢慢刷"——后者同样能把额度和账单耗光。
 *
 * 计数放在进程内存里。只有一个服务进程（systemd 单实例），够用；
 * 重启会清零，这是可接受的代价：重启不频繁，而且清零只会放宽、不会误封。
 * 要精确计数就得上数据库，第一版不值得。
 */

/** 三类花钱的调用。speech 只在缓存没命中（真的去合成了）时才计数 */
export type Quota = 'card' | 'speech' | 'assess';

/**
 * 默认上限。
 *
 * 单 IP 的额度故意放得宽：公司网络几十个人共用一个出口 IP，现场演示或
 * 内部分享时很容易撞上（这正是推广要用的场景），卡住真实用户比挡住脚本更糟。
 * 真正的成本保护靠全站上限。
 *
 * card 的全站上限对齐语音合成的免费额度：按每次查词约 130 字符估，
 * 10 万字符/月那档大约够 800 次全新查词，这里按天给 1000 次留出余量。
 * 实际单价核完（IFM-201）再调。
 */
const PER_IP: Record<Quota, number> = { card: 200, speech: 800, assess: 400 };
const TOTAL: Record<Quota, number> = { card: 1000, speech: 4000, assess: 2000 };

/** 环境变量名：DAILY_CARD_IP / DAILY_CARD_TOTAL / DAILY_SPEECH_IP / … */
function limit(kind: Quota, scope: 'IP' | 'TOTAL'): number {
  const fallback = scope === 'IP' ? PER_IP[kind] : TOTAL[kind];
  const raw = process.env[`DAILY_${kind.toUpperCase()}_${scope}`];
  const value = Number(raw);
  return raw && Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * 单独跟踪的 IP 上限。
 *
 * 超过之后新 IP 不再单独计数（全站上限仍然生效），避免被大量伪造 IP 撑爆内存。
 */
const MAX_TRACKED_IPS = 50_000;

/** 按北京时间划分"一天"。服务器时区可能是 UTC，不能直接用本地日期 */
function today(): string {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
}

const zero = (): Record<Quota, number> => ({ card: 0, speech: 0, assess: 0 });

let day = today();
let total = zero();
let perIp = new Map<string, Record<Quota, number>>();

function rollover(): void {
  const now = today();
  if (now !== day) {
    day = now;
    total = zero();
    perIp = new Map();
  }
}

/**
 * 取真实客户端 IP。
 *
 * **优先用 X-Real-IP，不要用 X-Forwarded-For 的第一段。**
 * Nginx 那边 X-Real-IP 写的是 `$remote_addr`（直接覆盖，客户端伪造不了），
 * 而 X-Forwarded-For 用的是 `$proxy_add_x_forwarded_for`——它会把客户端
 * 自带的同名头**追加在前面**。也就是说 XFF 的第一段是客户端说了算的，
 * 拿它分桶等于把单 IP 额度送给对方随便绕。
 *
 * 即便如此，这个值也只用来做额度分桶，不做任何鉴权。
 */
export function clientIp(headers: Headers): string {
  const real = headers.get('x-real-ip')?.trim();
  if (real) return real;
  // 本地开发没有反代，退回 XFF；线上这一步走不到
  const forwarded = headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || 'unknown';
}

export type QuotaVerdict = { ok: true } | { ok: false; scope: 'ip' | 'total' };

/** 只检查，不计数。真的发生了付费调用再调 `countQuota` */
export function checkQuota(kind: Quota, ip: string): QuotaVerdict {
  rollover();
  if (total[kind] >= limit(kind, 'TOTAL')) return { ok: false, scope: 'total' };
  const used = perIp.get(ip)?.[kind] ?? 0;
  if (used >= limit(kind, 'IP')) return { ok: false, scope: 'ip' };
  return { ok: true };
}

/** 记一次真实发生的付费调用 */
export function countQuota(kind: Quota, ip: string): void {
  rollover();
  total[kind] += 1;
  const current = perIp.get(ip);
  if (current) {
    current[kind] += 1;
  } else if (perIp.size < MAX_TRACKED_IPS) {
    const fresh = zero();
    fresh[kind] = 1;
    perIp.set(ip, fresh);
  }
}

/** 给用户看的说明。不说"你被限流了"，说清什么时候能再用 */
export const QUOTA_MESSAGE: Record<'ip' | 'total', string> = {
  ip: '今天查得有点多，先歇一歇——明天再来。',
  total: '今天的查询量到上限了，明天再来试试。',
};

/** 运维自己看的当前用量，配合日志排查 */
export function quotaSnapshot(): { day: string; total: Record<Quota, number>; ips: number } {
  rollover();
  return { day, total: { ...total }, ips: perIp.size };
}
