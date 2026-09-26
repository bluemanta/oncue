import { createHash, randomUUID } from 'node:crypto';
import COS from 'cos-nodejs-sdk-v5';
import { tts } from 'tencentcloud-sdk-nodejs-tts';
import type { Accent } from './card';

/**
 * 标准读音：腾讯云语音合成 + COS 缓存。
 *
 * 同一段文字、同一个音色、同一个语速只合成一次，之后直接从 COS 取，
 * 更快也更省钱（对应 PRD 技术方案里「音频存储」那一行）。
 */

export type Speed = 'normal' | 'slow';

/**
 * 英文音色。
 *
 * 注意：腾讯云目前的英文音色不区分美音和英音，官方音色表里没有 en-US / en-GB 的标注。
 * 所以 uk 暂时和 us 用同一个音色——界面上的美/英切换只改音标显示，不改朗读。
 * 等实际听过几个音色之后，可以用环境变量分别指定。
 */
const VOICE: Record<Accent, number> = {
  us: Number(process.env.TTS_VOICE_US || 101050),
  uk: Number(process.env.TTS_VOICE_UK || process.env.TTS_VOICE_US || 101050),
};

/** 腾讯云 Speed：-2 是 0.6 倍速，-1 是 0.8 倍速，0 是常速 */
const SPEED: Record<Speed, number> = {
  normal: 0,
  slow: Number(process.env.TTS_SLOW_SPEED ?? -1),
};

export const MAX_SPEECH_CHARS = 200;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}

/** COS SDK 用大写开头的字段名 */
function cosCredentials() {
  return {
    SecretId: requireEnv('TENCENT_SECRET_ID'),
    SecretKey: requireEnv('TENCENT_SECRET_KEY'),
  };
}

/** 腾讯云 API SDK 用小写开头的字段名 */
function apiCredentials() {
  return {
    secretId: requireEnv('TENCENT_SECRET_ID'),
    secretKey: requireEnv('TENCENT_SECRET_KEY'),
  };
}

function cacheKey(text: string, voiceType: number, speed: number): string {
  const hash = createHash('sha256').update(`${voiceType}|${speed}|${text}`).digest('hex').slice(0, 32);
  return `tts/${hash}.mp3`;
}

function cosClient() {
  return new COS(cosCredentials());
}

async function readCache(key: string): Promise<Buffer | null> {
  const Bucket = process.env.COS_BUCKET;
  const Region = process.env.COS_REGION;
  if (!Bucket || !Region) return null;
  try {
    const data = await cosClient().getObject({ Bucket, Region, Key: key });
    return Buffer.isBuffer(data.Body) ? data.Body : Buffer.from(data.Body as unknown as ArrayBuffer);
  } catch {
    // 没缓存过（NoSuchKey）或暂时取不到，都按未命中处理，继续去合成
    return null;
  }
}

async function writeCache(key: string, body: Buffer): Promise<void> {
  const Bucket = process.env.COS_BUCKET;
  const Region = process.env.COS_REGION;
  if (!Bucket || !Region) return;
  try {
    await cosClient().putObject({ Bucket, Region, Key: key, Body: body, ContentType: 'audio/mpeg' });
  } catch (error) {
    // 缓存写失败不该影响用户听到读音，只记日志
    console.error('[speech] 写入 COS 缓存失败', error);
  }
}

async function synthesize(text: string, voiceType: number, speed: number): Promise<Buffer> {
  const client = new tts.v20190823.Client({
    credential: apiCredentials(),
    region: process.env.TTS_REGION || 'ap-shanghai',
    profile: { httpProfile: { endpoint: 'tts.tencentcloudapi.com', reqTimeout: 30 } },
  });
  const response = (await client.TextToVoice({
    Text: text,
    SessionId: randomUUID(),
    VoiceType: voiceType,
    Speed: speed,
    PrimaryLanguage: 2, // 2 = 英文
    Codec: 'mp3',
    SampleRate: 16000,
  })) as { Audio?: string };
  if (!response.Audio) throw new Error('语音合成没有返回音频');
  return Buffer.from(response.Audio, 'base64');
}

export type SpeechResult =
  | { ok: true; audio: Buffer; cached: boolean }
  | { ok: false; message: string };

export async function getSpeech(text: string, accent: Accent, speed: Speed): Promise<SpeechResult> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, message: '没有要朗读的内容。' };
  if (trimmed.length > MAX_SPEECH_CHARS) return { ok: false, message: '这段文字太长，读不了。' };

  const voiceType = VOICE[accent];
  const rate = SPEED[speed];
  const key = cacheKey(trimmed, voiceType, rate);

  const cached = await readCache(key);
  if (cached) return { ok: true, audio: cached, cached: true };

  let audio: Buffer;
  try {
    audio = await synthesize(trimmed, voiceType, rate);
  } catch (error) {
    console.error('[speech] 合成失败', error);
    return { ok: false, message: '读音暂时取不到，稍后再试。' };
  }

  await writeCache(key, audio);
  return { ok: true, audio, cached: false };
}
