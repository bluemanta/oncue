import { parseWordCard, type WordCard } from '../../../lib/card';
import { FAIL_MESSAGE, type AssessmentResult } from '../../../lib/assessment';
import { assessmentFromSoe } from '../../../lib/assessment-from-soe';
import { assessPronunciation, type EvalMode } from '../../../lib/soe';
import { checkQuota, clientIp, countQuota, QUOTA_MESSAGE } from '../../../lib/quota';

/** 16k 单声道 16bit：1 秒 32000 字节。低于 0.4 秒不送评测 */
const MIN_PCM_BYTES = 12_800;
/** 最长 20 秒，防止有人一直按着 */
const MAX_PCM_BYTES = 640_000 + 1024;

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: 'invalid_form' }, { status: 400 });
  }

  const audio = form.get('audio');
  const refText = form.get('refText');
  const mode = form.get('mode');
  const cardRaw = form.get('card');

  if (!(audio instanceof Blob)) return Response.json({ error: 'missing_audio' }, { status: 400 });
  if (typeof refText !== 'string' || !refText.trim()) return Response.json({ error: 'missing_ref_text' }, { status: 400 });
  if (mode !== 'word' && mode !== 'sentence') return Response.json({ error: 'invalid_mode' }, { status: 400 });

  let card: WordCard | null = null;
  if (typeof cardRaw === 'string') {
    try { card = parseWordCard(JSON.parse(cardRaw)); } catch { card = null; }
  }
  if (!card) return Response.json({ error: 'invalid_card' }, { status: 400 });

  const buffer = Buffer.from(await audio.arrayBuffer());
  if (buffer.byteLength > MAX_PCM_BYTES) {
    return Response.json({ error: 'too_long' }, { status: 400 });
  }
  if (buffer.byteLength < MIN_PCM_BYTES) {
    const body: AssessmentResult = { ok: false, reason: 'too_short', message: FAIL_MESSAGE.too_short };
    return Response.json(body, { status: 200 });
  }

  // 每次跟读都是一次真实的评测调用，没有缓存可言，所以检查完直接计数
  const ip = clientIp(request.headers);
  const quota = checkQuota('assess', ip);
  if (!quota.ok) {
    return Response.json({ error: 'quota_exceeded', message: QUOTA_MESSAGE[quota.scope] }, { status: 429 });
  }
  countQuota('assess', ip);

  const evalMode: EvalMode = mode === 'word' ? 0 : 1;
  const outcome = await assessPronunciation(buffer, refText, evalMode);

  if (!outcome.ok) {
    console.error('[assess] 评测失败', outcome.code, outcome.message);
    const body: AssessmentResult = {
      ok: false,
      reason: 'service_error',
      message: outcome.message || FAIL_MESSAGE.service_error,
    };
    return Response.json(body, { status: 200 });
  }

  // 没识别到任何词，通常是没出声或者环境太吵
  if (!outcome.result.Words?.length) {
    const body: AssessmentResult = { ok: false, reason: 'no_speech', message: FAIL_MESSAGE.no_speech };
    return Response.json(body, { status: 200 });
  }

  const body: AssessmentResult = { ok: true, assessment: assessmentFromSoe(card, outcome.result) };
  return Response.json(body, { status: 200 });
}
