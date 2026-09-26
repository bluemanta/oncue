"use client";
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import type { Accent, WordCard } from '../../lib/card';
import { useSpeech } from './use-speech';

const SEGMENT_ON = 'h-8 rounded-lg bg-card px-3.5 text-sm font-medium text-ink shadow-[0_1px_2px_rgba(27,26,23,0.12)]';
const SEGMENT_OFF = 'h-8 rounded-lg px-3.5 text-sm text-muted';

function SpeakerIcon({ waves = 1 }: { waves?: number }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 10v4h4l5 4V6L8 10H4z" />
      {waves >= 1 && <path d="M16 9.5a3.5 3.5 0 0 1 0 5" />}
      {waves >= 2 && <path d="M18.5 7a7 7 0 0 1 0 10" />}
    </svg>
  );
}

/** 在原句里把要查的词标出来 */
function highlightTarget(sentence: string, surface: string | null): ReactNode {
  if (!surface) return sentence;
  const index = sentence.toLowerCase().indexOf(surface.toLowerCase());
  if (index < 0) return sentence;
  return (
    <>
      {sentence.slice(0, index)}
      <span className="font-semibold text-ink underline decoration-brand decoration-2 underline-offset-[3px]">
        {sentence.slice(index, index + surface.length)}
      </span>
      {sentence.slice(index + surface.length)}
    </>
  );
}

export default function CardView({ card, sample }: { card: WordCard; sample: boolean }) {
  const [accent, setAccent] = useState<Accent>('us');
  const [readExample, setReadExample] = useState(false);
  const [notice, setNotice] = useState('');
  const { play, loading, error } = useSpeech();

  // 跟读评测要等腾讯云口语评测接上，先明说而不是装作能用
  const pendingRecord = () => setNotice('跟读评测还没接上，下一步做。');

  const bottomLine = error || notice || '按住说话，松开看结果';

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col gap-4 px-5 pt-5 pb-0">
      <div className="flex h-11 items-center">
        <Link href="/" className="flex h-11 items-center gap-1 pr-3 text-[15px] text-ink">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          <span>返回</span>
        </Link>
      </div>

      {sample && (
        <p className="rounded-xl border border-dashed border-line-strong px-3.5 py-2.5 text-[13px] leading-[1.5] text-muted">
          样本数据 · 还没接上真接口，不管你输入什么都显示 schedule
        </p>
      )}

      {card.sourceSentence && (
        <div className="rounded-xl bg-fill-warm px-3.5 py-3 text-[14px] leading-[1.6] text-ink-soft">
          <span className="mr-1.5 text-xs font-medium text-muted">原句</span>
          {highlightTarget(card.sourceSentence, card.surface)}
        </div>
      )}

      <section className="flex flex-col gap-2.5 rounded-[20px] border border-line bg-card p-5">
        <div className="flex items-end justify-between gap-3">
          <h1 className="font-display text-[44px] leading-none font-semibold tracking-[-0.8px]">{card.word}</h1>
          <div role="group" aria-label="读音口音" className="flex shrink-0 rounded-[10px] bg-fill p-[3px]">
            <button type="button" aria-pressed={accent === 'us'} onClick={() => setAccent('us')} className={accent === 'us' ? SEGMENT_ON : SEGMENT_OFF}>美</button>
            <button type="button" aria-pressed={accent === 'uk'} onClick={() => setAccent('uk')} className={accent === 'uk' ? SEGMENT_ON : SEGMENT_OFF}>英</button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-latin text-lg text-ink-soft">{card.ipa[accent]}</span>
          <span className="text-[13px] text-muted">
            重音在{' '}
            {card.syllables.map((syllable, index) => (
              <span key={index}>
                {index > 0 && '·'}
                {index === card.stressIndex ? <strong className="text-ink">{syllable.toUpperCase()}</strong> : syllable}
              </span>
            ))}
          </span>
        </div>

        <div className="mt-1.5 flex gap-2.5">
          <button type="button" onClick={() => play('slow', card.word, accent, 'slow')} disabled={loading === 'slow'} aria-label={`慢速播放 ${card.word}`} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line-strong bg-card text-[15px] text-ink active:bg-fill disabled:opacity-50">
            <SpeakerIcon waves={1} />
            <span>{loading === 'slow' ? '加载中…' : '慢速'}</span>
          </button>
          <button type="button" onClick={() => play('normal', card.word, accent, 'normal')} disabled={loading === 'normal'} aria-label={`常速播放 ${card.word}`} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line-strong bg-card text-[15px] text-ink active:bg-fill disabled:opacity-50">
            <SpeakerIcon waves={2} />
            <span>{loading === 'normal' ? '加载中…' : '常速'}</span>
          </button>
        </div>
      </section>

      {card.context && (
        <section className="flex flex-col gap-1.5 rounded-2xl bg-brand-tint p-4">
          <h2 className="text-xs font-medium text-brand">在这句话里</h2>
          <p className="text-[16px] leading-[1.6] text-ink">
            {card.context.pos}，<strong>{card.context.gloss}</strong>。整句意思是：{card.context.sentenceTranslation}
          </p>
        </section>
      )}

      <section className="flex flex-col gap-[18px] rounded-[20px] border border-line bg-card px-5 py-[18px]">
        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-medium text-muted">释义</h2>
          {card.senses.map((sense, index) => (
            <p key={index} className="text-[15px] leading-[1.6]">
              <span className="mr-1.5 font-latin text-muted">{sense.pos}</span>
              {sense.meaning}
            </p>
          ))}
        </div>

        {card.pitfalls.length > 0 && (
          <>
            <div className="h-px bg-line-soft" />
            <div className="flex flex-col gap-2">
              <h2 className="text-xs font-medium text-fair">易错点</h2>
              {card.pitfalls.map((pitfall, index) => (
                <p key={index} className="text-[15px] leading-[1.6]">{pitfall}</p>
              ))}
            </div>
          </>
        )}

        <div className="h-px bg-line-soft" />
        <div className="flex flex-col gap-3.5">
          <h2 className="text-xs font-medium text-muted">例句</h2>
          {card.examples.map((example, index) => (
            <div key={index} className="flex items-start gap-2.5">
              <div className="flex flex-1 flex-col gap-0.5">
                <p className="font-latin text-[16px] leading-[1.5]">{example.en}</p>
                <p className="text-[13px] leading-[1.5] text-muted">{example.zh}</p>
              </div>
              <button type="button" onClick={() => play(`ex${index}`, example.en, accent, 'normal')} disabled={loading === `ex${index}`} aria-label={`播放例句 ${index + 1}`} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-fill text-ink active:bg-line disabled:opacity-50">
                <SpeakerIcon waves={loading === `ex${index}` ? 2 : 1} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {card.note && <p className="px-1 text-[13px] leading-[1.6] text-muted">{card.note}</p>}

      <div className="-mx-5 mt-auto flex flex-col items-center gap-3 rounded-t-3xl border-t border-line bg-card px-5 pt-3.5 pb-7">
        <div role="group" aria-label="跟读内容" className="flex rounded-[10px] bg-fill p-[3px]">
          <button type="button" aria-pressed={!readExample} onClick={() => setReadExample(false)} className={!readExample ? SEGMENT_ON : SEGMENT_OFF}>读单词</button>
          <button type="button" aria-pressed={readExample} onClick={() => setReadExample(true)} className={readExample ? SEGMENT_ON : SEGMENT_OFF}>读例句</button>
        </div>
        <button type="button" onClick={pendingRecord} aria-label="按住跟读" className="flex size-[72px] items-center justify-center rounded-full bg-brand text-white active:bg-brand-dark">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
            <path d="M12 17.5V21" />
          </svg>
        </button>
        <p role="status" className="text-[13px] text-muted">{bottomLine}</p>
      </div>
    </main>
  );
}
