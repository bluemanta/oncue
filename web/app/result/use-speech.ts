"use client";
import { useCallback, useRef, useState } from 'react';
import type { Accent } from '../../lib/card';

type Speed = 'normal' | 'slow';

/**
 * 播放标准读音。
 *
 * 同一段音频在本页内只取一次，之后重复点击立刻播放——对应 PRD 那条
 * 「用可反复点击的播放按钮代替发一条语音，想听几遍听几遍」。
 */
export function useSpeech() {
  const cache = useRef(new Map<string, string>());
  const current = useRef<HTMLAudioElement | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const play = useCallback(async (id: string, text: string, accent: Accent, speed: Speed) => {
    setError('');
    current.current?.pause();

    const key = `${accent}|${speed}|${text}`;
    let url = cache.current.get(key);

    if (!url) {
      setLoading(id);
      try {
        const response = await fetch('/api/speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, accent, speed }),
        });
        if (!response.ok) throw new Error('speech_failed');
        url = URL.createObjectURL(await response.blob());
        cache.current.set(key, url);
      } catch {
        setError('读音没取到，再点一次试试。');
        return;
      } finally {
        setLoading(null);
      }
    }

    const audio = new Audio(url);
    current.current = audio;
    try {
      await audio.play();
    } catch {
      setError('浏览器拦了自动播放，再点一次。');
    }
  }, []);

  return { play, loading, error };
}
