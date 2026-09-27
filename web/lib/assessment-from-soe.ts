import type { Assessment, Phoneme, Verdict } from './assessment';
import type { WordCard } from './card';
import type { SoeResult, SoeWord } from './soe';

/**
 * 把腾讯云口语评测的原始分数，翻译成卡片上那三档反馈。
 *
 * 两条产品原则写在这里（对应 PRD）：
 * 1. 每次只指出**最主要的一个问题**，不把所有毛病一次抖出来
 * 2. 说不准的事情不编。比如重音读错了但定位不到具体音节，就只给标准读法
 */

/** 分数线，都可以用环境变量调。第二周拿 20 个词实测时就是调这几个数 */
const GOOD_MIN = Number(process.env.SOE_GOOD_MIN || 85);
const POOR_MAX = Number(process.env.SOE_POOR_MAX || 60);
const PHONEME_BAD = Number(process.env.SOE_PHONEME_BAD || 60);
const PHONEME_AWFUL = Number(process.env.SOE_PHONEME_AWFUL || 40);

/** MatchTag：0 匹配，1 接近，2 不匹配，3 多读，4 漏读 */
const MATCH_OK = new Set([0, 1]);

/**
 * 评测服务返回的是 ARPAbet 音素（eh、jh、uw 这种），
 * 而卡片上显示的是国际音标。不换的话反馈页和卡片对不上，用户会懵。
 */
const ARPABET_TO_IPA: Record<string, string> = {
  aa: 'ɑ', ae: 'æ', ah: 'ə', ao: 'ɔ', aw: 'aʊ', ay: 'aɪ',
  b: 'b', ch: 'tʃ', d: 'd', dh: 'ð',
  eh: 'e', er: 'ər', ey: 'eɪ', f: 'f', g: 'g', hh: 'h',
  ih: 'ɪ', iy: 'iː', jh: 'dʒ', k: 'k', l: 'l', m: 'm',
  n: 'n', ng: 'ŋ', ow: 'oʊ', oy: 'ɔɪ', p: 'p', r: 'r',
  s: 's', sh: 'ʃ', t: 't', th: 'θ', uh: 'ʊ', uw: 'uː',
  v: 'v', w: 'w', y: 'j', z: 'z', zh: 'ʒ',
};

function toIpa(phone: string): string {
  // 有些实现会带重音数字后缀，例如 ah0 / eh1
  const bare = phone.toLowerCase().replace(/\d+$/, '');
  return ARPABET_TO_IPA[bare] ?? bare;
}

function flatPhones(words: SoeWord[]) {
  return words.flatMap(w => (w.PhoneInfos ?? []).map(p => ({ ...p, word: w.Word })));
}

export function assessmentFromSoe(card: WordCard, result: SoeResult): Assessment {
  const words = result.Words ?? [];
  const phones = flatPhones(words);

  const overall = result.SuggestedScore ?? result.PronAccuracy ?? 0;

  // 找出读得最差的那个音素
  const scored = phones
    .map((p, index) => ({ index, phone: p, score: p.PronAccuracy ?? 100 }))
    .filter(x => x.phone.Phone);
  const worst = scored.length
    ? scored.reduce((a, b) => (b.score < a.score ? b : a))
    : null;

  /*
   * 重音判断为什么要加「总分也低」这个条件：
   *
   * 2026-09-27 实测（scripts/soe-smoke.mjs，用 TTS 合成的标准发音喂进去）：
   *   preference   p 上 Stress=true Detected=true   → 正确
   *   renegotiate  g 上 Stress=true Detected=false  → 误报，那可是标准发音，98.7 分
   *   comparable   全部 false，根本没标重音
   *   schedule     全部 false
   *
   * 也就是说重音标记时有时无，单独拿它下「重音读错了」的结论会大量误伤。
   * 所以只有在总分也不高的时候才采信它；总分高就当重音没问题。
   * 第二周用 20 个常错词实测后再决定要不要调整或干脆不判重音。
   */
  const stressFlagged = phones.some(
    p => p.Stress !== undefined && p.DetectedStress !== undefined && p.Stress !== p.DetectedStress,
  );
  const stressWrong = stressFlagged && overall < GOOD_MIN;

  /*
   * 小方块显示什么，取决于读的是单词还是句子。
   *
   * 读单词 → 显示音素，能精确到「哪个音读错了」。
   * 读例句 → 显示单词。一句八个词能拆出三十来个音素，全糊在屏幕上没法看，
   *          也违背 PRD「每次只指出最主要的一个问题」。句子的有用粒度是词。
   */
  const isSentence = words.length > 1;

  const wordScored = words
    .map((w, index) => ({ index, word: w, score: w.PronAccuracy ?? 100 }))
    .filter(x => x.word.Word);

  /*
   * 挑「读得最差的词」时跳过 a / the / of 这类虚词。
   *
   * 实测把 schedule 故意读成 shed，评测确实标出了 schedule，但分最低的是冠词 a。
   * 这类又短又轻读的词本来就容易拿低分，让它占住「最主要的问题」这个位置，
   * 用户会收到「这句里 a 读得最不稳」这种毫无用处的建议。
   * 所以优先在实词里找；实在只有虚词有问题，再退回全部。
   */
  const contentWords = wordScored.filter(x => (x.word.Word as string).length >= 3);
  const pickFrom = contentWords.length ? contentWords : wordScored;
  const worstWord = pickFrom.length
    ? pickFrom.reduce((a, b) => (b.score < a.score ? b : a))
    : null;

  const phonemes: Phoneme[] = isSentence
    ? wordScored.map(({ word, score, index }) => {
        const bad = score < PHONEME_BAD || (word.MatchTag !== undefined && !MATCH_OK.has(word.MatchTag));
        return {
          symbol: word.Word as string,
          ok: !bad,
          note: bad && worstWord !== null && index === worstWord.index ? describe(word.MatchTag, score) : undefined,
        };
      })
    : scored.map(({ phone, score, index }) => {
        const bad = score < PHONEME_BAD || (phone.MatchTag !== undefined && !MATCH_OK.has(phone.MatchTag));
        return {
          symbol: toIpa(phone.Phone as string),
          ok: !bad,
          // 只给最差的那一个写说明，避免满屏都是标注
          note: bad && worst !== null && index === worst.index ? describe(phone.MatchTag, score) : undefined,
        };
      });

  const hasBadPhoneme = phonemes.some(p => !p.ok);

  let verdict: Verdict;
  if (stressWrong || overall < POOR_MAX || (worst?.score ?? 100) < PHONEME_AWFUL) {
    verdict = 'poor';
  } else if (!hasBadPhoneme && overall >= GOOD_MIN) {
    verdict = 'good';
  } else {
    verdict = 'fair';
  }

  const score = Math.max(0, Math.min(100, Math.round(overall)));

  const stressedSyllable = (card.syllables[card.stressIndex] ?? card.word).toUpperCase();

  if (verdict === 'good') {
    return {
      verdict,
      score,
      headline: '读对了',
      summary: isSentence
        ? '整句都读清楚了，节奏也顺。'
        : `每个音都到位，重音也在 ${stressedSyllable} 上。`,
      phonemes,
      stress: null,
      fix: null,
    };
  }

  if (verdict === 'poor' && stressWrong) {
    return {
      verdict,
      score,
      headline: '不对',
      summary: '重音放错了位置。',
      // 评测只给逐音素的重音标记，定位不到你把重音放到了哪个音节，
      // 所以 yours 留空，只显示标准读法，不编造
      phonemes: hasBadPhoneme ? phonemes : [],
      stress: { syllables: card.syllables, yours: null, standard: card.stressIndex },
      fix: `把力气放在 ${stressedSyllable} 这个音节，读得重一点、长一点；其余音节轻轻带过。先听一遍慢读，再跟一遍。`,
    };
  }

  // 句子指到「哪个词」，单词指到「哪个音」——粒度对得上用户能改的东西
  const weakWord = worstWord?.word.Word ?? '';
  const weakPhone = worst?.phone.Phone ? toIpa(worst.phone.Phone) : '';

  let fix: string;
  if (isSentence && weakWord) {
    fix = `这句里 ${weakWord} 读得最不稳。先把这个词单独念准，再连回整句读一遍。`;
  } else if (!isSentence && weakPhone) {
    fix = `重点改 /${weakPhone}/ 这个音。先单独把它念准，再放回整个词里读一遍。`;
  } else {
    fix = '整体再读慢一点，把每个音都咬清楚。';
  }

  return {
    verdict,
    score,
    headline: verdict === 'poor' ? '不对' : '基本对',
    summary: verdict === 'poor'
      ? (isSentence ? '有一个词差得比较多。' : '有一个音差得比较多。')
      : '只有 1 个地方要改。',
    phonemes,
    stress: null,
    fix,
  };
}

function describe(matchTag: number | undefined, score: number): string {
  if (matchTag === 4) return '漏读了';
  if (matchTag === 3) return '多读了';
  if (matchTag === 2) return '读错了';
  if (score < PHONEME_AWFUL) return '差得较多';
  return '不太准';
}
