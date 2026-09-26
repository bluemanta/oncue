"use client";
import { useState, type FormEvent } from 'react';

type Item = { id: string; text: string; done: boolean };
export default function Workspace() {
  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: value }) });
      if (!response.ok) throw new Error('request_failed');
      const item: Item = await response.json();
      setItems(current => [...current, item]);
      setText('');
    } catch { setError('暂时没有添加成功，请重试。'); }
    finally { setBusy(false); }
  }
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 sm:py-20">
      <header className="mb-14 flex items-center gap-3 text-sm font-medium tracking-wide">
        <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-900 text-white">↗</span>
        新的开始
      </header>
      <p className="mb-4 text-xs font-semibold tracking-widest text-emerald-800">从一件小事开始</p>
      <h1 className="mb-5 text-4xl font-semibold tracking-tight sm:text-5xl">把想法，变成第一步。</h1>
      <p className="max-w-lg text-base leading-7 text-slate-600">写下一件你想完成的事。做完后，轻轻勾选。</p>
      <section aria-label="我的清单" className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <form onSubmit={add} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="next-step" className="mb-2 block text-sm font-medium">下一步</label>
            <input id="next-step" name="step" value={text} onChange={e => setText(e.target.value)} maxLength={120} required placeholder="例如：画出第一个页面" className="w-full rounded-xl border border-slate-300 px-4 py-3" />
          </div>
          <button type="submit" disabled={busy || !text.trim()} className="rounded-xl bg-emerald-900 px-6 py-3 font-medium text-white hover:bg-emerald-800">{busy ? '添加中…' : '添加'}</button>
        </form>
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        <div aria-live="polite" className="mt-6 text-sm text-slate-500">{items.length === 0 ? '清单还是空的，先写下一件小事吧。' : `已完成 ${items.filter(item => item.done).length} / ${items.length}`}</div>
        <ul className="mt-3 divide-y divide-slate-100">
          {items.map(item => <li key={item.id} className="py-4"><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={item.done} onChange={() => setItems(current => current.map(entry => entry.id === item.id ? { ...entry, done: !entry.done } : entry))} className="mt-1 h-4 w-4 shrink-0 accent-emerald-800" /><span className={`min-w-0 break-words ${item.done ? 'text-slate-400 line-through' : ''}`}>{item.text}</span></label></li>)}
        </ul>
      </section>
      <p className="mt-6 text-center text-xs text-slate-500">练习清单 · 刷新页面后重新开始</p>
    </main>
  );
}
