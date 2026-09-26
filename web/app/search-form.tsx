"use client";
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition, type FormEvent } from 'react';

const MAX_LENGTH = 300;

export default function SearchForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  const [hint, setHint] = useState('');
  // 跳转到结果页要等服务端生成卡片，这几秒里按钮得有反应，不然像点了没用
  const [pending, startTransition] = useTransition();

  async function paste() {
    setHint('');
    try {
      const clip = (await navigator.clipboard.readText()).trim();
      if (!clip) return setHint('剪贴板是空的。');
      setText(clip.slice(0, MAX_LENGTH));
      inputRef.current?.focus();
    } catch {
      // Safari 会在用户拒绝弹窗时走到这里，浏览器不支持读剪贴板时也一样
      setHint('这个浏览器不让自动读剪贴板，请长按输入框手动粘贴。');
      inputRef.current?.focus();
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = text.trim();
    if (!value || pending) return;
    startTransition(() => {
      router.push(`/result?q=${encodeURIComponent(value)}`);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-[18px] border border-line bg-card p-4">
      <label htmlFor="q" className="text-[13px] font-medium text-muted">要查的词或句子</label>
      <textarea
        id="q"
        ref={inputRef}
        rows={5}
        value={text}
        maxLength={MAX_LENGTH}
        onChange={event => setText(event.target.value)}
        placeholder="比如：Let's schedule a call with the client next week."
        className="w-full resize-none border-none bg-transparent p-0 text-[17px] leading-[1.55] text-ink outline-none"
      />
      <div className="flex items-center gap-2.5 border-t border-line-soft pt-3">
        <button type="button" onClick={paste} className="flex h-11 items-center gap-1.5 rounded-xl border border-line-strong bg-card px-3.5 text-[15px] text-ink active:bg-fill">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="6" y="4" width="12" height="17" rx="2" />
            <path d="M9 4V3h6v1" />
            <path d="M9 10h6" />
            <path d="M9 14h4" />
          </svg>
          <span>粘贴</span>
        </button>
        <button type="submit" disabled={!text.trim() || pending} className="ml-auto flex h-11 items-center justify-center gap-1.5 rounded-xl bg-brand px-5 text-[15px] font-medium text-white active:bg-brand-dark disabled:opacity-60">
          <span>{pending ? '查询中…' : '查一下'}</span>
          {pending ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" className="animate-spin">
              <path d="M12 3a9 9 0 1 0 9 9" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          )}
        </button>
      </div>
      {hint && <p role="status" className="text-[13px] leading-[1.5] text-muted">{hint}</p>}
    </form>
  );
}
