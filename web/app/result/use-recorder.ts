"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FailReason } from '../../lib/assessment';

/** 短于这个时长就不送去评测——按一下手滑的误触，给分也不可信 */
const MIN_DURATION_MS = 400;
/** 单次跟读的上限，防止一直按着不放 */
const MAX_DURATION_MS = 15000;
/**
 * 录完之后把麦克风留着多久。
 *
 * 每次按住都重新申请麦克风的话，Safari 会反复弹授权框，用起来很烦（IFM-192）。
 * 留着复用就只申请一次，按下去也更快。代价是这段时间里系统的录音指示灯还亮着，
 * 所以只留一小会儿，够连着重读几遍就行；切到后台会立刻释放。
 */
const KEEP_ALIVE_MS = 60_000;

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
  const keepAlive = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * 手指已经松开、但麦克风还没准备好。
   *
   * 第一次使用时 iOS 会弹权限询问，用户点「允许」的时候早就松手了；
   * 不记这个标记的话，麦克风准备好之后会自己开始录，然后没人来停，
   * 界面就永远卡在「正在录」。
   */
  const releasedEarly = useRef(false);

  /** 真正关掉麦克风（指示灯灭） */
  const closeMic = useCallback(() => {
    if (keepAlive.current) {
      clearTimeout(keepAlive.current);
      keepAlive.current = null;
    }
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
  }, []);

  /** 结束一次录音，但麦克风先留着，过一会儿没再用才关 */
  const endTake = useCallback(() => {
    recorder.current = null;
    if (autoStop.current) {
      clearTimeout(autoStop.current);
      autoStop.current = null;
    }
    if (keepAlive.current) clearTimeout(keepAlive.current);
    keepAlive.current = setTimeout(closeMic, KEEP_ALIVE_MS);
  }, [closeMic]);

  // 切到后台就立刻关掉麦克风，不让指示灯在用户看不见的时候亮着
  useEffect(() => {
    const onHidden = () => { if (document.hidden) closeMic(); };
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      closeMic();
    };
  }, [closeMic]);

  /** 拿到可用的麦克风：已有还活着就直接复用，避免重复申请权限 */
  const acquire = useCallback(async (): Promise<MediaStream> => {
    const live = stream.current?.getAudioTracks().some(t => t.readyState === 'live');
    if (stream.current && live) {
      if (keepAlive.current) {
        clearTimeout(keepAlive.current);
        keepAlive.current = null;
      }
      return stream.current;
    }
    closeMic();
    const media = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.current = media;
    return media;
  }, [closeMic]);

  const start = useCallback(async (): Promise<FailReason | null> => {
    if (state !== 'idle') return null;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      // http 页面（localhost 除外）拿不到麦克风，正式环境必须是 https
      return 'no_permission';
    }
    setState('starting');
    releasedEarly.current = false;
    try {
      const media = await acquire();
      if (releasedEarly.current) {
        // 等权限的这段时间里手指已经松开了，别开始录
        endTake();
        setState('idle');
        return null;
      }
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
      closeMic();
      setState('idle');
      return 'no_permission';
    }
  }, [state, acquire, endTake, closeMic]);

  const stop = useCallback(async (): Promise<RecorderStop | null> => {
    const mr = recorder.current;
    if (!mr || state !== 'recording') {
      // 还在等麦克风就松手了：做个标记，让 start 拿到流之后直接放弃
      releasedEarly.current = true;
      endTake();
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
    endTake();
    setState('idle');

    if (durationMs < MIN_DURATION_MS) return { ok: false, reason: 'too_short' };
    if (blob.size === 0) return { ok: false, reason: 'no_speech' };
    return { ok: true, recording: { blob, mimeType, durationMs } };
  }, [state, endTake]);

  return { state, start, stop };
}
