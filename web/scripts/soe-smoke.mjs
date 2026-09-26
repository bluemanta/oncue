/**
 * 口语评测自测：用腾讯云语音合成造一段标准读音，直接喂给口语评测。
 *
 * 不需要麦克风就能验证整条链路。合成出来的是「标准发音」，分数应该很高——
 * 如果分数很低或者报错，说明链路某处接错了。
 *
 * 用法：node scripts/soe-smoke.mjs [单词或句子] [0=单词模式 1=句子模式]
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

const text = process.argv[2] || 'schedule';
const mode = Number(process.argv[3] ?? 0);

console.log(`== 1. 合成「${text}」的标准读音（16k 裸 PCM）==`);
const client = new tts.v20190823.Client({
  credential: { secretId: env.TENCENT_SECRET_ID, secretKey: env.TENCENT_SECRET_KEY },
  region: env.TTS_REGION || 'ap-shanghai',
  profile: { httpProfile: { endpoint: 'tts.tencentcloudapi.com', reqTimeout: 30 } },
});
const spoken = await client.TextToVoice({
  Text: text,
  SessionId: randomUUID(),
  VoiceType: Number(env.TTS_VOICE_US || 501009),
  Speed: 0,
  PrimaryLanguage: 2,
  Codec: 'pcm',
  SampleRate: 16000,
});
const pcm = Buffer.from(spoken.Audio, 'base64');
console.log(`   ${pcm.length} 字节，约 ${(pcm.length / 32000).toFixed(2)} 秒`);

console.log(`\n== 2. 送去口语评测（eval_mode=${mode}）==`);
const started = Date.now();
const outcome = await assessPronunciation(pcm, text, mode);
console.log(`   耗时 ${((Date.now() - started) / 1000).toFixed(1)} 秒`);

if (!outcome.ok) {
  console.log('   ❌ 失败:', outcome.code ?? '', outcome.message);
  process.exit(1);
}
const r = outcome.result;
console.log('   ✅ 成功');
console.log(`   总分=${r.SuggestedScore} 准确度=${r.PronAccuracy} 流利度=${r.PronFluency} 完整度=${r.PronCompletion}`);
for (const w of r.Words ?? []) {
  console.log(`   词「${w.Word}」准确度 ${w.PronAccuracy} MatchTag=${w.MatchTag}`);
  for (const p of w.PhoneInfos ?? []) {
    console.log(`     ${String(p.Phone).padEnd(6)} 准确度 ${String(p.PronAccuracy).padStart(3)} MatchTag=${p.MatchTag} Stress=${p.Stress} Detected=${p.DetectedStress}`);
  }
}
console.log('\n== 3. 原始返回的字段（核对我们解析得对不对）==');
console.log(JSON.stringify(r, null, 2).slice(0, 1600));
