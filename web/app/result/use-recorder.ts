"use client";
import { useCallback, useRef, useState } from 'react';
import type { FailReason } from '../../lib/assessment';

/** 短于这个时长就不送去评测——按一下手滑的误触，给分也不可信 */
const MIN_DURATION_MS = 400;
/** 单次跟读的上限，防止一直按着不放 */
const MAX_DURATION_MS = 15000;

export type RecorderState = 'idle' | 'starting' | 'recording';

export type Recording = { blob: Blob; mimeType: string; durationMs: number };

export type RecorderStop =
  | { ok: true; recording: Recording }
  | { ok: false; reason: FailReason };

export function useRecorder() {
  const [state, setState] = useState<RecorderState>('idle');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const autoStop = useRef<ReturnType<typeof setTimeout> | null>(null);

  const release = useCallback(() => {
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    recorder.current = null;
    if (autoStop.current) {
      clearTimeout(autoStop.current);
      autoStop.current = null;
    }
  }, []);

  const start = useCallback(async (): Promise<FailReason | null> => {
    if (state !== 'idle') return null;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      // http 页面（localhost 除外）拿不到麦克风，正式环境必须是 https
      return 'no_permission';
    }
    setState('starting');
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      chunks.current = [];
      const mr = new MediaRecorder(media);
      mr.ondataavailable = event => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      recorder.current = mr;
      startedAt.current = Date.now();
      mr.start();
      autoStop.current = setTimeout(() => {
        if (recorder.current?.state === 'recording') recorder.current.stop();
      }, MAX_DURATION_MS);
      setState('recording');
      return null;
    } catch {
      release();
      setState('idle');
      return 'no_permission';
    }
  }, [state, release]);

  const stop = useCallback(async (): Promise<RecorderStop | null> => {
    const mr = recorder.current;
    if (!mr || state !== 'recording') {
      release();
      setState('idle');
      return null;
    }
    const durationMs = Date.now() - startedAt.current;

    const blob = await new Promise<Blob>(resolve => {
      mr.onstop = () => resolve(new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' }));
      if (mr.state === 'recording') mr.stop();
      else resolve(new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' }));
    });

    const mimeType = mr.mimeType || 'audio/webm';
    release();
    setState('idle');

    if (durationMs < MIN_DURATION_MS) return { ok: false, reason: 'too_short' };
    if (blob.size === 0) return { ok: false, reason: 'no_speech' };
    return { ok: true, recording: { blob, mimeType, durationMs } };
  }, [state, release]);

  return { state, start, stop };
}
