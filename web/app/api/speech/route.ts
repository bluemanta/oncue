import { getSpeech, MAX_SPEECH_CHARS, type Speed } from '../../../lib/speech';
import { checkQuota, clientIp, countQuota, QUOTA_MESSAGE } from '../../../lib/quota';
import type { Accent } from '../../../lib/card';

const ACCENTS: Accent[] = ['us', 'uk'];
const SPEEDS: Speed[] = ['normal', 'slow'];

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }
  const { text, accent, speed } = body as Record<string, unknown>;

  if (typeof text !== 'string' || !text.trim() || text.trim().length > MAX_SPEECH_CHARS) {
    return Response.json({ error: 'invalid_text' }, { status: 400 });
  }
  if (typeof accent !== 'string' || !ACCENTS.includes(accent as Accent)) {
    return Response.json({ error: 'invalid_accent' }, { status: 400 });
  }
  if (typeof speed !== 'string' || !SPEEDS.includes(speed as Speed)) {
    return Response.json({ error: 'invalid_speed' }, { status: 400 });
  }

  // 命中 COS 缓存的不花钱，所以先放行、事后按"真的去合成了"计数
  const ip = clientIp(request.headers);
  const quota = checkQuota('speech', ip);
  if (!quota.ok) {
    return Response.json({ error: 'quota_exceeded', message: QUOTA_MESSAGE[quota.scope] }, { status: 429 });
  }

  const result = await getSpeech(text, accent as Accent, speed as Speed);
  if (!result.ok) {
    return Response.json({ error: 'speech_failed', message: result.message }, { status: 502 });
  }
  if (!result.cached) countQuota('speech', ip);

  return new Response(new Uint8Array(result.audio), {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(result.audio.length),
      'Cache-Control': 'private, max-age=86400',
      'X-Speech-Cached': result.cached ? '1' : '0',
    },
  });
}
