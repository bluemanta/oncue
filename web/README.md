# OnCue单词 · web

手机网页本体。来自 project-starter 0.1.0 的 web-app 模板；选型原因和依赖例外见 `tech-profile.json`，协作约定见 `AGENTS.md`，技术标准见 `STACK.md`。

产品背景和整体说明在仓库根的 [CLAUDE.md](../CLAUDE.md)。

## 开始

需要 Node.js 24（有 nvm 就 `nvm use`）。

```sh
npm ci
cp .env.example .env.local   # 填值，文件里每个变量都有注释
npm run dev                  # http://127.0.0.1:3000，只监听本机
```

`.env.example` 是本项目配置信息最全的地方：用哪个模型、为什么不能用 deepseek-r1、音色 501009 是怎么选的、每日上限怎么调，都写在注释里。

| 命令 | 做什么 |
| --- | --- |
| `npm run check` | 技术栈一致性 + TypeScript + ESLint，改完代码至少跑这个 |
| `npm run build` | 构建。动了路由、依赖或构建配置时跑一遍 |
| `npm run start` | 跑构建后的生产版本 |

检查通过不等于在手机上好用，该看的界面还是要真机看一眼。

## 目录

```
app/                页面与接口
  page.tsx          首页（输入框、一键粘贴）
  search-form.tsx   输入表单
  home-suggestions.tsx  输入框下面那块：没记录时给示例，有记录时显示"最近查过"
  add-to-home.tsx   用过两次之后提示"添加到主屏幕"
  result/           结果卡片 + 跟读反馈两屏
  api/speech/       读音接口（语音合成 + COS 缓存）
  api/assess/       跟读评测接口（口语评测）
  robots.ts         禁止爬虫抓 /result 和 /api，它们每次调用都花钱
  globals.css       配色、字体、全局样式
lib/                服务端能力与共享逻辑
  card.ts           结果卡片的数据结构与校验
  prompt.ts         给大模型的提示词
  providers/        出卡片的统一接口：types(契约) / lkeap(真接口) / sample(离线样本)
  speech.ts         语音合成 + COS 缓存
  soe.ts            口语评测（WebSocket，签名是 HMAC-SHA1，和别处不一样）
  assessment*.ts    三档反馈的数据结构、分数翻译、假数据
  quota.ts          每日调用上限，花钱的最后一道闸
  history.ts        查词记录，只存在用户自己的手机上
scripts/            技术栈检查、口语评测冒烟测试、图标生成
```

## 几条容易踩的

- **密钥只放 `.env.local`**，不进代码、不进仓库。只提交不含真实值的 `.env.example`。
- **`NEXT_PUBLIC_MOCK_ASSESSMENT` 线上必须留空。** 假的发音反馈比没有反馈更糟，部署脚本里有一道卡关专门查这个。
- **离线也能调界面**：`CARD_PROVIDER=sample` 用手写样本出卡片，不花钱、不用密钥。
- **新增重要依赖**要在 `tech-profile.json` 的 `exceptions` 里补一条，写清用途和代价。
- 开发服务只绑 `127.0.0.1`；端口冲突先确认占用者，别直接杀别人的进程。
