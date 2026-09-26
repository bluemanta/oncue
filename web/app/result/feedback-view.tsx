"use client";
import Link from 'next/link';
import type { Assessment, Verdict } from '../../lib/assessment';
import type { WordCard } from '../../lib/card';

const TONE: Record<Verdict, { text: string; bg: string; badge: string }> = {
  good: { text: 'text-good', bg: 'bg-good-bg', badge: 'bg-good' },
  fair: { text: 'text-fair', bg: 'bg-fair-bg', badge: 'bg-fair' },
  poor: { text: 'text-poor', bg: 'bg-poor-bg', badge: 'bg-poor' },
};

function VerdictIcon({ verdict }: { verdict: Verdict }) {
  const common = {
    width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2.2,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (verdict === 'good') return <svg {...common}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
  if (verdict === 'fair') return <svg {...common}><path d="M12 7v6" /><path d="M12 17h.01" /></svg>;
  return <svg {...common}><path d="M7 7l10 10" /><path d="M17 7L7 17" /></svg>;
}

function SpeakerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 10v4h4l5 4V6L8 10H4z" />
      <path d="M16 9.5a3.5 3.5 0 0 1 0 5" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21" />
    </svg>
  );
}

/** 一个音节，重音的那个大写加粗 */
function Syllables({ syllables, stressIndex, color }: { syllables: string[]; stressIndex: number; color: string }) {
  return (
    <span className="font-latin text-lg">
      {syllables.map((syllable, index) => (
        <span key={index}>
          {index > 0 && ' · '}
          {index === stressIndex
            ? <strong className={color}>{syllable.toUpperCase()}</strong>
            : syllable}
        </span>
      ))}
    </span>
  );
}

export default function FeedbackView({
  card, assessment, onBack, onRetry, onPlayStandard, playing,
}: {
  card: WordCard;
  assessment: Assessment;
  onBack: () => void;
  onRetry: () => void;
  onPlayStandard: () => void;
  playing: boolean;
}) {
  const tone = TONE[assessment.verdict];
  const good = assessment.verdict === 'good';
  const badPhoneme = assessment.phonemes.some(phoneme => !phoneme.ok);
  // 读对了时整排音素都显示（都是好的）；有音素读错时显示并标出来；
  // 问题出在重音、音素都没错时不显示这一排，直接给重音对比——照设计稿的三个分支来
  const showPhonemes = assessment.phonemes.length > 0 && (good || badPhoneme);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col gap-[18px] px-5 pt-5 pb-8">
      <div className="flex h-11 items-center">
        <button type="button" onClick={onBack} className="flex h-11 items-center gap-1 pr-3 text-[15px] text-ink">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          <span>返回单词</span>
        </button>
      </div>

      {/* 长单词要能换行，不然 indemnification 这类词会撑出屏幕 */}
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className={`font-display font-semibold tracking-[-0.5px] break-words ${card.word.length > 14 ? 'text-2xl' : 'text-[32px]'}`}>{card.word}</span>
        <span className="font-latin text-base text-muted">{card.ipa.us}</span>
      </div>

      <div className={`flex items-center gap-3.5 rounded-[18px] p-[18px] ${tone.bg}`}>
        <div className={`flex size-12 shrink-0 items-center justify-center rounded-full text-white ${tone.badge}`}>
          <VerdictIcon verdict={assessment.verdict} />
        </div>
        <div className="flex flex-col gap-0.5">
          <div className={`text-xl font-bold ${tone.text}`}>{assessment.headline}</div>
          <div className="text-sm text-ink-soft">{assessment.summary}</div>
        </div>
      </div>

      {showPhonemes && (
        <div className="flex flex-col gap-2.5">
          {badPhoneme && <h2 className="text-xs font-medium text-muted">问题在这里</h2>}
          <div className="flex flex-wrap gap-1.5">
            {assessment.phonemes.map((phoneme, index) => (
              <span
                key={index}
                className={
                  phoneme.ok
                    ? 'rounded-lg border border-line bg-card px-2.5 py-1.5 font-latin text-[15px]'
                    : `rounded-lg border-2 px-2.5 py-1.5 font-latin text-[15px] font-medium ${tone.bg} ${tone.text} border-current`
                }
              >
                {phoneme.symbol}{phoneme.note && ` ${phoneme.note}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {assessment.stress && (
        <div className="flex flex-col gap-2.5">
          <h2 className="text-xs font-medium text-muted">重音对比</h2>
          <div className="flex flex-col gap-2 rounded-2xl border border-line bg-card px-4 py-3.5">
            {/* 定位不到用户把重音放哪了就不显示这一行，不编一个「你读的」出来 */}
            {assessment.stress.yours !== null && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] text-muted">你读的</span>
                  <Syllables syllables={assessment.stress.syllables} stressIndex={assessment.stress.yours} color="text-poor" />
                </div>
                <div className="h-px bg-line-soft" />
              </>
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-muted">{assessment.stress.yours === null ? '重音应该在' : '标准读法'}</span>
              <Syllables syllables={assessment.stress.syllables} stressIndex={assessment.stress.standard} color="text-good" />
            </div>
          </div>
        </div>
      )}

      {assessment.fix && (
        <div className="flex flex-col gap-1.5 rounded-2xl border border-line bg-card p-4">
          <h2 className="text-xs font-medium text-muted">怎么改</h2>
          <p className="text-[16px] leading-[1.6]">{assessment.fix}</p>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2.5 pt-4">
        {good ? (
          <>
            <Link href="/" className="flex h-13 items-center justify-center rounded-2xl bg-brand text-base font-medium text-white">查下一个词</Link>
            <button type="button" onClick={onBack} className="flex h-12 items-center justify-center rounded-2xl border border-line-strong bg-card text-[15px] text-ink">再练一遍</button>
          </>
        ) : (
          <div className="flex gap-2.5">
            <button type="button" onClick={onPlayStandard} disabled={playing} className="flex h-13 flex-1 items-center justify-center gap-1.5 rounded-2xl border border-line-strong bg-card text-[15px] text-ink disabled:opacity-50">
              <SpeakerIcon />
              <span>{playing ? '加载中…' : '听标准读音'}</span>
            </button>
            <button type="button" onClick={onRetry} className="flex h-13 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-brand text-[15px] font-medium text-white">
              <MicIcon />
              <span>再读一遍</span>
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
