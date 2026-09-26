/**
 * 跟读评测结果的数据结构。
 *
 * 对应 design/Feedback.dc.html 的三个分支和 PRD 的 F5。
 * 真实数据将来自腾讯云新版口语评测（SpeakingAssessmentStream，WebSocket），
 * 换服务商时只换生成它的那一层，界面不动。
 */

/** 三档结果：读对了 / 基本对 / 不对 */
export type Verdict = 'good' | 'fair' | 'poor';

export type Phoneme = {
  symbol: string;
  ok: boolean;
  /** 出错时的一句话说明，例如「没读出来」 */
  note?: string;
};

export type StressCompare = {
  syllables: string[];
  /**
   * 你读的时候重音落在哪个音节。
   *
   * 为 null 表示「知道重音读错了，但说不准你把重音放到了哪个音节」——
   * 评测服务给的是逐音素的重音标记，音素和音节对不上号。
   * 这种情况只显示标准读法，不编一个「你读的」出来。
   */
  yours: number | null;
  /** 标准读法的重音在哪个音节 */
  standard: number;
};

export type Assessment = {
  verdict: Verdict;
  /** 大字标题：读对了 / 基本对 / 不对 */
  headline: string;
  /** 标题下面那行小字 */
  summary: string;
  phonemes: Phoneme[];
  /** 只在重音有问题时给，用来画「你读的 vs 标准读法」 */
  stress: StressCompare | null;
  /** 「怎么改」那段话。读对了的时候为 null */
  fix: string | null;
};

/**
 * 评测失败的原因。
 *
 * PRD 明确要求：录音无效时说清楚原因，不给一个不可靠的分数。
 */
export type FailReason = 'too_short' | 'too_quiet' | 'no_speech' | 'no_permission' | 'service_error';

export type AssessmentResult =
  | { ok: true; assessment: Assessment }
  | { ok: false; reason: FailReason; message: string };

export const FAIL_MESSAGE: Record<FailReason, string> = {
  too_short: '录音太短了，按住多读一会儿再松手。',
  too_quiet: '声音太小或者环境太吵，换个安静点的地方再试。',
  no_speech: '没听到人声，确认一下麦克风有没有被挡住。',
  no_permission: '浏览器没给麦克风权限。在网址栏左边的图标里打开它。',
  service_error: '评测服务暂时没响应，稍后再试一次。',
};

/** 国际音标里需要当成一个音的组合，拆音素时不能拆开 */
const DIGRAPHS = [
  'dʒ', 'tʃ', 'uː', 'iː', 'ɑː', 'ɔː', 'ɜː', 'ɪə', 'eə', 'ʊə',
  'eɪ', 'aɪ', 'ɔɪ', 'aʊ', 'oʊ', 'əʊ',
];

/**
 * 把音标字符串粗略拆成音素，用来画反馈页上那一排小方块。
 *
 * 这只是接上真实评测之前的临时办法——腾讯云口语评测会直接返回逐音素结果，
 * 到时候这个函数就不用了。
 */
export function splitIpa(ipa: string): string[] {
  const clean = ipa.replace(/[/[\]ˈˌ.·\s]/g, '');
  const out: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const two = clean.slice(i, i + 2);
    if (DIGRAPHS.includes(two)) {
      out.push(two);
      i += 2;
    } else {
      out.push(clean[i]);
      i += 1;
    }
  }
  return out;
}
