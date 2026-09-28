"use client";
import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { Accent, WordCard } from '../../lib/card';
import { historyServerSnapshot, historySnapshot, recordLookup, subscribeHistory } from '../../lib/history';
import type { Assessment, AssessmentResult } from '../../lib/assessment';
import { micFailureMessage } from './mic-help';
import { mockAssessment } from '../../lib/assessment-mock';
import { useSpeech } from './use-speech';
import { useRecorder } from './use-recorder';
import { toWav16kMono } from './wav';
import FeedbackView from './feedback-view';

const SEGMENT_ON = 'h-8 rounded-lg bg-card px-3.5 text-sm font-medium text-ink shadow-[0_1px_2px_rgba(27,26,23,0.12)]';
const SEGMENT_OFF = 'h-8 rounded-lg px-3.5 text-sm text-muted';

/**
 * 朗读用的口音。
 *
 * 腾讯云的英文音色实听下来都是美音，没有英音可选，所以界面上暂时不放美/英切换。
 * 卡片数据里两种音标都还在（ipa.us / ipa.uk），等有了英音音色，把切换加回来即可。
 */
const ACCENT: Accent = 'us';

/**
 * 是否用假的评测结果。
 *
 * 只在本地开发时打开（.env.local 里设 NEXT_PUBLIC_MOCK_ASSESSMENT=1），
 * 用来看三档反馈界面的样子。线上一定要关着——假的发音反馈比没有反馈更糟，
 * 用户可能真以为自己读对了。接上腾讯云口语评测后这个开关整个删掉。
 */
const MOCK_ASSESSMENT = process.env.NEXT_PUBLIC_MOCK_ASSESSMENT === '1';

/**
 * 单词标题的字号。
 *
 * 设计稿的 44px 是按 schedule 这种长度画的，但 indemnification、
 * infrastructure 这类长词在 44px 下会撑出卡片（实测 330px 内容挤 293px 空间）。
 * 按长度分三档缩一缩，超长的还会换行。
 */
function titleSize(word: string): string {
  if (word.length <= 11) return 'text-[44px] leading-none';
  if (word.length <= 15) return 'text-[34px] leading-[1.05]';
  return 'text-[26px] leading-[1.1]';
}

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

export default function CardView({ card, sample, query }: { card: WordCard; sample: boolean; query: string }) {
  const [readExample, setReadExample] = useState(false);
  const [notice, setNotice] = useState('');
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [round, setRound] = useState(0);
  const [assessing, setAssessing] = useState(false);
  const { play, loading, error } = useSpeech();
  const recorder = useRecorder();

  // 记录只写在这台手机上，不上云（见 lib/history.ts）
  useEffect(() => {
    recordLookup(card.word, query);
  }, [card.word, query]);

  /** 上次查这个词是哪天（只在不是今天时才有值），对应 PRD F6 的「你某天查过」 */
  const { seenBefore } = useSyncExternalStore(subscribeHistory, historySnapshot, historyServerSnapshot);
  const seenDay = seenBefore && seenBefore.word.toLowerCase() === card.word.toLowerCase() ? seenBefore.day : null;

  /** 跟读的目标：单词，或者第一句例句 */
  const target = readExample ? (card.examples[0]?.en ?? card.word) : card.word;

  async function startRecording() {
    setNotice('');
    const failed = await recorder.start();
    if (failed) setNotice(micFailureMessage(failed));
  }

  /** 触摸被系统抢走时收尾：把录音停掉丢弃，不送评测，也不卡在「正在录」 */
  async function cancelRecording() {
    await recorder.stop();
    setNotice('录音被打断了，再按一次试试。');
  }

  async function finishRecording() {
    const result = await recorder.stop();
    if (!result) return;
    if (!result.ok) {
      setNotice(micFailureMessage(result.reason));
      return;
    }
    if (MOCK_ASSESSMENT) {
      // 只在本地调界面时用，轮换三档
      setAssessment(mockAssessment(card, round));
      setRound(round + 1);
      return;
    }

    setAssessing(true);
    setNotice('正在评测…');
    try {
      // 评测服务只收 16k 单声道 PCM，浏览器录的格式要先转
      const wav = await toWav16kMono(result.recording.blob);
      const form = new FormData();
      form.append('audio', wav, 'recording.wav');
      form.append('refText', target);
      form.append('mode', readExample ? 'sentence' : 'word');
      form.append('card', JSON.stringify(card));

      const response = await fetch('/api/assess', { method: 'POST', body: form });
      // 到了每日上限：照实说明，别让人反复重读
      if (response.status === 429) {
        const body = await response.json().catch(() => null);
        setNotice(body?.message || '今天的跟读次数到上限了，明天再来。');
        return;
      }
      if (!response.ok) throw new Error('assess_failed');
      const data: AssessmentResult = await response.json();
      if (!data.ok) {
        setNotice(data.message);
        return;
      }
      setNotice('');
      setAssessment(data.assessment);
    } catch {
      setNotice('评测没跑通，再试一次。');
    } finally {
      setAssessing(false);
    }
  }

  if (assessment) {
    return (
      <FeedbackView
        card={card}
        assessment={assessment}
        playing={loading === 'standard'}
        onBack={() => setAssessment(null)}
        onRetry={() => setAssessment(null)}
        onPlayStandard={() => play('standard', target, ACCENT, 'slow')}
      />
    );
  }

  const recording = recorder.state === 'recording';
  const bottomLine = error || notice
    || (recording ? '正在录…松开看结果' : `按住说话，松开看结果`);

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

      {/* PRD F6：再查同一个词时提醒一句。没读熟才会再查，这句话本身就是提示 */}
      {seenDay && (
        <p className="px-1 text-[13px] leading-[1.5] text-muted">
          你 {seenDay} 查过这个词，这次把它读熟。
        </p>
      )}

      <section className="flex flex-col gap-2.5 rounded-[20px] border border-line bg-card p-5">
        <h1 className={`font-display font-semibold tracking-[-0.8px] break-words ${titleSize(card.word)}`}>{card.word}</h1>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-latin text-lg text-ink-soft">
            <span className="mr-1.5 font-sans text-[13px] text-muted">美</span>
            {card.ipa[ACCENT]}
          </span>
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
          <button type="button" onClick={() => play('slow', card.word, ACCENT, 'slow')} disabled={loading === 'slow'} aria-label={`慢速播放 ${card.word}`} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line-strong bg-card text-[15px] text-ink active:bg-fill disabled:opacity-50">
            <SpeakerIcon waves={1} />
            <span>{loading === 'slow' ? '加载中…' : '慢速'}</span>
          </button>
          <button type="button" onClick={() => play('normal', card.word, ACCENT, 'normal')} disabled={loading === 'normal'} aria-label={`常速播放 ${card.word}`} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line-strong bg-card text-[15px] text-ink active:bg-fill disabled:opacity-50">
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
              <button type="button" onClick={() => play(`ex${index}`, example.en, ACCENT, 'normal')} disabled={loading === `ex${index}`} aria-label={`播放例句 ${index + 1}`} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-fill text-ink active:bg-line disabled:opacity-50">
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
        <button
          type="button"
          aria-label={`按住跟读 ${target}`}
          disabled={assessing}
          draggable={false}
          onPointerDown={event => {
            if (assessing) return;
            // iOS 长按默认会触发文本选择、放大镜和拖拽，把 pointer 序列打断。
            // 必须在这里挡掉，否则按下去录不上音，还会选中页面文字。
            event.preventDefault();
            // 手指按住后稍微挪动就会滑出按钮，捕获指针让事件继续回到这里，
            // 不然会中途误判成松手
            event.currentTarget.setPointerCapture?.(event.pointerId);
            void startRecording();
          }}
          onPointerUp={event => {
            event.currentTarget.releasePointerCapture?.(event.pointerId);
            void finishRecording();
          }}
          // 系统手势抢走触摸（来电、通知、手势冲突）时会走这里，必须收尾，否则一直卡在录音中
          onPointerCancel={() => { void cancelRecording(); }}
          onContextMenu={event => event.preventDefault()}
          className={`flex size-[72px] touch-none items-center justify-center rounded-full text-white transition-transform select-none [-webkit-touch-callout:none] ${recording ? 'scale-110 bg-poor' : 'bg-brand active:bg-brand-dark'} ${assessing ? 'opacity-50' : ''}`}
        >
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
