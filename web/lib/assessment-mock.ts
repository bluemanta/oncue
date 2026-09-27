import { splitIpa, type Assessment, type Verdict } from './assessment';
import type { WordCard } from './card';

/**
 * 假的评测结果，只为在接上腾讯云口语评测之前把三档反馈界面做出来看效果。
 *
 * 每按一次跟读轮换一档（基本对 → 读对了 → 不对），方便一次把三种状态都看到。
 * 接上真服务后整个文件删掉。
 */

const ORDER: Verdict[] = ['fair', 'good', 'poor'];

function stressedSyllable(card: WordCard): string {
  return (card.syllables[card.stressIndex] ?? card.word).toUpperCase();
}

export function mockAssessment(card: WordCard, round: number): Assessment {
  const verdict = ORDER[round % ORDER.length];
  const symbols = splitIpa(card.ipa.us);
  const allOk = symbols.map(symbol => ({ symbol, ok: true }));

  if (verdict === 'good') {
    return {
      verdict,
      score: 96,
      headline: '读对了',
      summary: `每个音都到位，重音也在 ${stressedSyllable(card)} 上。`,
      phonemes: allOk,
      stress: null,
      fix: null,
    };
  }

  if (verdict === 'fair') {
    const last = symbols.length - 1;
    return {
      verdict,
      score: 78,
      headline: '基本对',
      summary: '只有 1 个地方要改。',
      phonemes: allOk.map((p, i) => (i === last ? { ...p, ok: false, note: '没读出来' } : p)),
      stress: null,
      fix: `结尾的 /${symbols[last]}/ 被吞掉了。读完前面的音之后别急着停，把最后这个音轻轻收住。`,
    };
  }

  // poor：重音放错，是最需要"你读的 vs 标准读法"对比的一种
  const wrongStress = card.stressIndex === 0 ? card.syllables.length - 1 : 0;
  return {
    verdict,
    score: 52,
    headline: '不对',
    summary: '重音放错了位置。',
    phonemes: allOk,
    stress: { syllables: card.syllables, yours: wrongStress, standard: card.stressIndex },
    fix: `把力气放在 ${stressedSyllable(card)} 这个音节，读得重一点、长一点；其余音节轻轻带过。先听一遍慢读，再跟一遍。`,
  };
}
