#!/usr/bin/env node
import { access, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const excluded = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.venv', 'venv', '__pycache__', 'coverage', 'data', 'outputs', 'artifacts', '.cache']);
const extraPackages = {
  next: 'framework', nuxt: 'framework', vue: 'framework', svelte: 'framework', '@angular/core': 'framework',
  express: 'backend', fastify: 'backend', hono: 'backend', '@nestjs/core': 'backend',
  prisma: 'database', '@prisma/client': 'database', 'drizzle-orm': 'database', 'better-sqlite3': 'database',
  sqlite3: 'database', postgres: 'database', pg: 'database', mysql2: 'database', mongodb: 'database', mongoose: 'database',
  '@supabase/supabase-js': 'cloud', 'next-auth': 'auth', 'better-auth': 'auth', stripe: 'payments', resend: 'email',
};
const exists = async path => { try { await access(path); return true; } catch { return false; } };
const json = async path => JSON.parse(await readFile(path, 'utf8'));

export async function checkStack(root) {
  const errors = [], warnings = [];
  let pkg, profile, baseline;
  try { [pkg, profile, baseline] = await Promise.all(['package.json', 'tech-profile.json', 'stack-baseline.json'].map(file => json(join(root, file)))); }
  catch { return { errors: ['无法读取 package.json、tech-profile.json 或 stack-baseline.json。'], warnings }; }
  if ([pkg, profile, baseline].some(value => !value || typeof value !== 'object' || Array.isArray(value)) || !baseline.dependencies || typeof baseline.dependencies !== 'object' || Array.isArray(baseline.dependencies)) return { errors: ['工程配置必须是有效的 JSON 对象，基线必须包含 dependencies。'], warnings };
  if (profile.schemaVersion !== 1 || !['web-app', 'lite-app'].includes(profile.template) || profile.template !== baseline.template || profile.templateVersion !== baseline.templateVersion) errors.push('技术档案的模板或版本无效。');
  if (profile.projectName !== pkg.name || typeof profile.reason !== 'string' || !profile.reason.trim()) errors.push('项目名称或选型原因缺失/不一致。');
  if (!['static', 'local-server', 'hosted-server'].includes(profile.runtime)) errors.push('runtime 无效。');
  if (!['none', 'sqlite', 'postgresql', 'other'].includes(profile.storage)) errors.push('storage 无效。');
  if (typeof profile.python?.enabled !== 'boolean' || typeof profile.python?.reason !== 'string') errors.push('python 必须包含 enabled 和 reason。');
  if (profile.python?.enabled && !profile.python.reason?.trim()) errors.push('引入 Python 必须记录用途。');
  const exceptions = Array.isArray(profile.exceptions) ? profile.exceptions : [];
  if (!Array.isArray(profile.exceptions) || exceptions.some(e => typeof e?.dependency !== 'string' || typeof e?.reason !== 'string' || !e.reason.trim())) errors.push('exceptions 必须是包含 dependency 和非空 reason 的数组。');
  const approved = new Set(exceptions.filter(e => typeof e?.dependency === 'string' && e?.reason?.trim()).map(e => e.dependency));
  if (!/^npm@\d+\.\d+\.\d+$/.test(pkg.packageManager ?? '')) errors.push('packageManager 必须固定到 npm 的具体版本。');
  for (const file of ['pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb']) if (await exists(join(root, file))) errors.push(`发现混用锁文件：${file}`);
  for (const file of ['AGENTS.md', 'README.md', '.env.example', '.gitignore', '.nvmrc', 'package-lock.json']) if (!await exists(join(root, file))) errors.push(`缺少 ${file}`);
  for (const command of ['dev', 'build', 'check', 'check:stack', 'typecheck', 'lint']) if (!pkg.scripts?.[command]) errors.push(`缺少 npm run ${command}`);
  if (!pkg.scripts?.check?.includes('check:stack')) errors.push('check 必须包含 check:stack。');
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const [dependency, version] of Object.entries(baseline.dependencies ?? {})) {
    if (!(dependency in deps)) errors.push(`基础依赖缺失：${dependency}`);
    else if (deps[dependency] !== version) {
      if (approved.has(dependency)) warnings.push(`${dependency} 已记录版本例外；需自行验证兼容。`);
      else errors.push(`${dependency} 偏离基线 ${version}，升级前记录例外并验证。`);
    }
  }
  for (const [dependency, version] of Object.entries(deps)) {
    if (!/^\d+\.\d+\.\d+$/.test(version)) warnings.push(`${dependency} 未固定稳定版本：${version}`);
    if (extraPackages[dependency] && !Object.hasOwn(baseline.dependencies, dependency)) {
      if (!approved.has(dependency)) errors.push(`新 ${extraPackages[dependency]} 依赖 ${dependency} 未记录引入原因。`);
      if (extraPackages[dependency] === 'database' && profile.storage === 'none') errors.push(`${dependency} 已加入，但 storage 仍为 none。`);
    }
  }
  for (const companion of ['eslint-config-next', '@next/eslint-plugin-next']) if (deps.next && deps[companion] && deps[companion] !== deps.next) errors.push(`next 与 ${companion} 必须使用相同版本。`);
  if (deps.react !== deps['react-dom']) errors.push('react 与 react-dom 必须使用相同版本。');
  try {
    const lock = await json(join(root, 'package-lock.json'));
    const entry = lock.packages?.[''];
    if (lock.name !== pkg.name || entry?.name !== pkg.name) errors.push('锁文件项目名称不一致。');
    for (const section of ['dependencies', 'devDependencies']) {
      const declared = pkg[section] ?? {}, locked = entry?.[section] ?? {};
      if (JSON.stringify(Object.entries(declared).sort()) !== JSON.stringify(Object.entries(locked).sort())) errors.push(`锁文件 ${section} 与 package.json 不同步。`);
    }
  } catch { errors.push('package-lock.json 不可读。'); }
  try {
    const ignore = await readFile(join(root, '.gitignore'), 'utf8');
    for (const pattern of ['node_modules/', '.env*', '!.env.example', 'data/']) if (!ignore.split(/\r?\n/).includes(pattern)) errors.push(`.gitignore 缺少 ${pattern}`);
    const config = await json(join(root, 'tsconfig.json'));
    if (config.compilerOptions?.strict !== true) errors.push('TypeScript strict 必须启用。');
  } catch { errors.push('无法检查 .gitignore 或 tsconfig.json。'); }
  async function scan(directory, relative = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || excluded.has(entry.name)) continue;
      const file = join(relative, entry.name);
      if (entry.isDirectory()) await scan(join(directory, entry.name), file);
      else {
        if (entry.name === 'package.json' && relative && !approved.has(`workspace:${relative}`)) errors.push(`新增子工程 ${relative}，请记录 workspace:${relative} 例外。`);
        if ((entry.name.endsWith('.py') || ['pyproject.toml', 'requirements.txt'].includes(entry.name)) && !profile.python?.enabled) errors.push(`发现 Python 文件 ${file}，尚未记录用途。`);
      }
    }
  }
  await scan(root);
  if (Number(process.versions.node.split('.')[0]) !== 24) warnings.push('模板验证基线为 Node.js 24 LTS，请使用 .nvmrc 或重新验证运行环境。');
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await checkStack(resolve(process.argv[2] ?? '.'));
    for (const warning of result.warnings) console.warn(`提示：${warning}`);
    for (const error of result.errors) console.error(`错误：${error}`);
    console.log(result.errors.length ? `failed：${result.errors.length} 项需修正。` : 'verified：技术栈检查通过。');
    process.exitCode = result.errors.length ? 1 : 0;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
