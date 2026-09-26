/**
 * 验证「评测原始分数 → 三档反馈」这一层。
 *
 * 用 TTS 合成两种音频：
 *   正样本 = 读对的词本身，应判「读对了」
 *   负样本 = 读成另一个词（模拟读错），应判「基本对」或「不对」
 *
 * 用法：node scripts/soe-verdict.mjs
 */
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tts } from 'tencentcloud-sdk-nodejs-tts';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }),
);
Object.assign(process.env, env);

const { assessPronunciation } = await import('../lib/soe.ts');
const { assessmentFromSoe } = await import('../lib/assessment-from-soe.ts');

const client = new tts.v20190823.Client({
  credential: { secretId: env.TENCENT_SECRET_ID, secretKey: env.TENCENT_SECRET_KEY },
  region: env.TTS_REGION || 'ap-shanghai',
  profile: { httpProfile: { endpoint: 'tts.tencentcloudapi.com', reqTimeout: 30 } },
});

async function speak(text) {
  const r = await client.TextToVoice({
    Text: text, SessionId: randomUUID(), VoiceType: Number(env.TTS_VOICE_US || 501009),
    Speed: 0, PrimaryLanguage: 2, Codec: 'pcm', SampleRate: 16000,
  });
  return Buffer.from(r.Audio, 'base64');
}

const card = (word, syllables, stressIndex) => ({
  word, sourceSentence: null, surface: null, context: null,
  ipa: { us: '', uk: '' }, syllables, stressIndex,
  senses: [{ pos: 'n.', meaning: '—' }], pitfalls: [],
  examples: [{ en: '—', zh: '—' }], note: null,
});

const CASES = [
  { label: '正样本：读对 schedule',      say: 'schedule',   ref: 'schedule',   card: card('schedule', ['sched', 'ule'], 0),        expect: 'good' },
  { label: '正样本：读对 preference',    say: 'preference', ref: 'preference', card: card('preference', ['pref', 'rence'], 0),      expect: 'good' },
  { label: '负样本：把 schedule 读成 shed',  say: 'shed',   ref: 'schedule',   card: card('schedule', ['sched', 'ule'], 0),        expect: '非 good' },
  { label: '负样本：把 purchase 读成 perfect', say: 'perfect', ref: 'purchase', card: card('purchase', ['pur', 'chase'], 0),       expect: '非 good' },
];

for (const c of CASES) {
  const pcm = await speak(c.say);
  const outcome = await assessPronunciation(pcm, c.ref, 0);
  if (!outcome.ok) { console.log(`❌ ${c.label} → 调用失败: ${outcome.message}`); continue; }
  const a = assessmentFromSoe(c.card, outcome.result);
  const score = (outcome.result.SuggestedScore ?? 0).toFixed(1);
  const bad = a.phonemes.filter(p => !p.ok).map(p => p.symbol + (p.note ? `(${p.note})` : '')).join(' ');
  const hit = c.expect === 'good' ? a.verdict === 'good' : a.verdict !== 'good';
  console.log(`${hit ? '✅' : '❌'} ${c.label}`);
  console.log(`   总分 ${score} → 判定「${a.headline}」（期望 ${c.expect}）`);
  console.log(`   音素 ${a.phonemes.map(p => p.symbol).join(' ')}`);
  if (bad) console.log(`   标红 ${bad}`);
  if (a.fix) console.log(`   怎么改：${a.fix}`);
  console.log();
}
