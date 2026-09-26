import { createHmac, randomUUID } from 'node:crypto';

/**
 * 腾讯云智聆口语评测（新版，WebSocket 流式）。
 *
 * 和本项目其它腾讯云服务不一样的两点，接的时候最容易踩：
 * 1. 签名用的是 HMAC-SHA1，不是别处那套 TC3-HMAC-SHA256
 * 2. 走 WebSocket，不是普通的 HTTP 接口
 *
 * 旧版的 InitOralProcess / TransmitOralProcess 已停止新购，不要用。
 */

const HOST = 'soe.cloud.tencent.com';
const PATH_PREFIX = '/soe/api/';

/** 评测模式：0 单词，1 句子 */
export type EvalMode = 0 | 1;

/** 每片音频的字节数。官方建议 40ms 一片，16k 单声道 16bit 即 1280 字节 */
const CHUNK_BYTES = 1280;
const CHUNK_INTERVAL_MS = 40;

export type SoePhone = {
  /** 音素本身 */
  Phone?: string;
  /** 正确的音素（读错时和 Phone 不同） */
  DetectedStress?: boolean;
  Stress?: boolean;
  PronAccuracy?: number;
  MatchTag?: number;
  MemBeginTime?: number;
  MemEndTime?: number;
};

export type SoeWord = {
  Word?: string;
  PronAccuracy?: number;
  PronFluency?: number;
  MatchTag?: number;
  PhoneInfos?: SoePhone[];
};

export type SoeResult = {
  PronAccuracy?: number;
  PronFluency?: number;
  PronCompletion?: number;
  SuggestedScore?: number;
  Words?: SoeWord[];
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}

/**
 * 按官方规则生成带签名的连接地址。
 *
 * 规则：除 signature 外的参数按字典序排好拼成 URL（不含 wss:// 协议头），
 * 用 SecretKey 做 HMAC-SHA1，再 Base64，最后 URL Encode 挂到 signature 上。
 */
export function buildSignedUrl(params: Record<string, string | number>, appId: string, secretKey: string): string {
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  const toSign = `${HOST}${PATH_PREFIX}${appId}?${sorted}`;
  const signature = createHmac('sha1', secretKey).update(toSign).digest('base64');
  return `wss://${HOST}${PATH_PREFIX}${appId}?${sorted}&signature=${encodeURIComponent(signature)}`;
}

/** 从 WAV 里取出裸 PCM。找 data 块，找不到就退回跳过标准的 44 字节头 */
export function pcmFromWav(wav: Buffer): Buffer {
  if (wav.length > 12 && wav.toString('ascii', 0, 4) === 'RIFF') {
    let offset = 12;
    while (offset + 8 <= wav.length) {
      const id = wav.toString('ascii', offset, offset + 4);
      const size = wav.readUInt32LE(offset + 4);
      if (id === 'data') return wav.subarray(offset + 8, Math.min(offset + 8 + size, wav.length));
      offset += 8 + size + (size % 2);
    }
    return wav.subarray(44);
  }
  return wav; // 本来就是裸 PCM
}

export type SoeOutcome =
  | { ok: true; result: SoeResult }
  | { ok: false; code?: number; message: string };

/**
 * 把一段录音送去评测，拿回结果。
 *
 * 虽然接口是流式的，我们的交互是「按住说完再松手」，所以这里是一次性把
 * 录好的音频按节奏喂进去，等最终结果。
 */
export async function assessPronunciation(
  audio: Buffer,
  refText: string,
  evalMode: EvalMode,
): Promise<SoeOutcome> {
  const secretId = requireEnv('TENCENT_SECRET_ID');
  const secretKey = requireEnv('TENCENT_SECRET_KEY');
  const appId = requireEnv('TENCENT_APPID');

  const pcm = pcmFromWav(audio);
  if (pcm.length < CHUNK_BYTES) return { ok: false, message: '录音太短，没法评测。' };

  const now = Math.floor(Date.now() / 1000);
  const url = buildSignedUrl({
    secretid: secretId,
    timestamp: now,
    expired: now + 3600,
    nonce: Math.floor(Math.random() * 1_000_000_000),
    voice_id: randomUUID().replace(/-/g, '').slice(0, 32),
    server_engine_type: '16k_en',
    voice_format: 0, // 0 = 裸 PCM
    eval_mode: evalMode,
    score_coeff: Number(process.env.SOE_SCORE_COEFF || 2.0),
    text_mode: 0,
    ref_text: encodeURIComponent(refText),
  }, appId, secretKey);

  return new Promise<SoeOutcome>(resolve => {
    let settled = false;
    const done = (outcome: SoeOutcome) => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch { /* 已经关了就算了 */ }
      clearTimeout(guard);
      resolve(outcome);
    };

    const ws = new WebSocket(url);
    // 整体兜底：音频本身最长 15 秒，加上握手和推理留足余量
    const guard = setTimeout(() => done({ ok: false, message: '评测服务响应超时。' }), 45_000);

    ws.binaryType = 'arraybuffer';

    ws.onerror = () => done({ ok: false, message: '连不上评测服务。' });
    ws.onclose = () => done({ ok: false, message: '评测连接被关闭，没拿到结果。' });

    ws.onmessage = event => {
      let payload: { code?: number; message?: string; final?: number; result?: SoeResult };
      try {
        payload = JSON.parse(String(event.data));
      } catch {
        return; // 非 JSON 的帧直接忽略
      }
      if (payload.code !== undefined && payload.code !== 0) {
        return done({ ok: false, code: payload.code, message: payload.message || '评测失败' });
      }
      if (payload.final === 1) {
        return payload.result
          ? done({ ok: true, result: payload.result })
          : done({ ok: false, message: '评测结束但没有返回结果。' });
      }
    };

    ws.onopen = async () => {
      try {
        // 官方要求不快于 1:1 实时率，且两片之间不能空超过 6 秒
        for (let i = 0; i < pcm.length; i += CHUNK_BYTES) {
          if (settled) return;
          ws.send(pcm.subarray(i, Math.min(i + CHUNK_BYTES, pcm.length)));
          await new Promise(r => setTimeout(r, CHUNK_INTERVAL_MS));
        }
        if (!settled) ws.send(JSON.stringify({ type: 'end' }));
      } catch {
        done({ ok: false, message: '音频发送失败。' });
      }
    };
  });
}
