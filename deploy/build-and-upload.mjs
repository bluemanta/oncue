#!/usr/bin/env node
/**
 * 本地构建 → 打包 → 上传 COS → 打印预签名下载地址。
 *
 * 为什么不在服务器上构建：产物压缩后只有 16MB，本地构建更快，
 * 服务器也不用装 400 多兆的 node_modules。
 *
 * 为什么密钥走 COS 而不是直接写进 TAT 命令：TAT 的命令内容会留在
 * 腾讯云的执行记录里。预签名地址只有 1 小时有效期，用完还会把对象覆盖掉。
 *
 * 用法：node deploy/build-and-upload.mjs
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import COS from '../web/node_modules/cos-nodejs-sdk-v5/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'web');

const env = Object.fromEntries(
  fs.readFileSync(path.join(WEB, '.env.local'), 'utf8')
    .split('\n').filter(l => l.trim() && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; })
);

const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 13); // 20260926T2355 -> 2026092623
const release = `${stamp}`;
const Bucket = env.COS_BUCKET;
const Region = env.COS_REGION;
if (!Bucket || !Region) throw new Error('.env.local 缺少 COS_BUCKET / COS_REGION');

console.log('== 1. 构建（standalone） ==');
// NEXT_PUBLIC_* 是在构建时写死进前端代码的，不是运行时读的。
// .env.local 里为了本地调界面设了 NEXT_PUBLIC_MOCK_ASSESSMENT=1，
// 构建时必须显式清掉，否则假的跟读结果会被打包上线。
// shell 里的环境变量优先级高于 .env.local。
execSync('rm -rf .next && npm run build', {
  cwd: WEB,
  stdio: 'inherit',
  env: { ...process.env, NEXT_PUBLIC_MOCK_ASSESSMENT: '' },
});

console.log('\n== 1b. 卡关：确认假的跟读结果没有被打包 ==');
const chunkDir = path.join(WEB, '.next/static/chunks');
const chunkText = fs.readdirSync(chunkDir)
  .filter(f => f.endsWith('.js'))
  .map(f => fs.readFileSync(path.join(chunkDir, f), 'utf8'))
  .join('\n');
// 假结果的三档文案只存在于 mock 里；真结果的文案由服务端生成，不会进前端包
const mockHits = (chunkText.match(/读对了|基本对|重音放错了位置/g) || []).length;
// 真实评测那条路必须在：前端要 POST 到 /api/assess
const realHits = (chunkText.match(/\/api\/assess/g) || []).length;
console.log(`  假结果文案 ${mockHits} 处（必须为 0）`);
console.log(`  真实评测调用 ${realHits} 处（必须 ≥ 1）`);
if (mockHits > 0) throw new Error('构建产物里带着假的跟读结果，拒绝上传。检查 NEXT_PUBLIC_MOCK_ASSESSMENT。');
if (realHits === 0) throw new Error('构建产物里找不到真实评测调用，分支被编译错了，拒绝上传。');
console.log('  通过');

console.log('\n== 2. 打包 ==');
// standalone 里没有 static，要一起打包，服务器上再并进 standalone/.next/static
// COPYFILE_DISABLE + --no-xattrs + --no-mac-metadata：不让 macOS 的扩展属性和
// ._ 附属文件混进来。否则 Linux 上的 GNU tar 会刷屏警告，还会解出 1500 多个 ._ 文件。
const tgz = `/tmp/oncue-${release}.tgz`;
execSync(
  `COPYFILE_DISABLE=1 tar --no-xattrs --no-mac-metadata -czf ${tgz} -C .next standalone static`,
  { cwd: WEB, stdio: 'inherit' },
);
const size = (fs.statSync(tgz).size / 1024 / 1024).toFixed(1);
console.log(`打包完成 ${tgz}，${size} MB`);

const junk = execSync(`tar -tzf ${tgz} | grep -c '/\\._\\|^\\._' || true`).toString().trim();
if (junk !== '0') throw new Error(`包里还有 ${junk} 个 macOS ._ 附属文件，停止上传`);
console.log('已确认包里没有 macOS 附属文件');

console.log('\n== 3. 生成服务器用的环境变量文件 ==');
// 线上不带 NEXT_PUBLIC_MOCK_ASSESSMENT —— 假的跟读结果绝不能上线
const SERVER_KEYS = [
  'TENCENT_SECRET_ID', 'TENCENT_SECRET_KEY',
  'LKEAP_REGION', 'LKEAP_MODEL', 'CARD_PROVIDER',
  'TTS_REGION', 'TTS_VOICE_US', 'TTS_SLOW_SPEED',
  'COS_BUCKET', 'COS_REGION',
  'TENCENT_APPID', 'SOE_SCORE_COEFF', 'SOE_GOOD_MIN', 'SOE_POOR_MAX',
];
const envFile = '/tmp/oncue-server.env';
fs.writeFileSync(envFile, SERVER_KEYS.filter(k => env[k]).map(k => `${k}=${env[k]}`).join('\n') + '\n', { mode: 0o600 });
console.log('包含变量:', SERVER_KEYS.filter(k => env[k]).join(', '));

const cos = new COS({ SecretId: env.TENCENT_SECRET_ID, SecretKey: env.TENCENT_SECRET_KEY });

async function upload(localPath, key) {
  await cos.putObject({ Bucket, Region, Key: key, Body: fs.readFileSync(localPath) });
  const url = await cos.getObjectUrl({ Bucket, Region, Key: key, Sign: true, Expires: 3600, Method: 'GET' });
  return url;
}

console.log('\n== 4. 上传 COS ==');
const tgzKey = `deploy/oncue-${release}.tgz`;
const envKey = `deploy/oncue-${release}.env`;
const tgzUrl = await upload(tgz, tgzKey);
const envUrl = await upload(envFile, envKey);
console.log(`已上传 ${tgzKey} 和 ${envKey}`);

fs.writeFileSync(path.join(ROOT, 'deploy/.last-release.json'), JSON.stringify({
  release, tgzKey, envKey, tgzUrl, envUrl, sizeMB: size,
  createdAt: new Date().toISOString(),
}, null, 2) + '\n', { mode: 0o600 });

fs.rmSync(envFile, { force: true });
console.log(`\n版本号 ${release}`);
console.log('预签名地址已写入 deploy/.last-release.json（1 小时有效，该文件不进版本库）');
