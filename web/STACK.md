# 新项目技术标准 · 0.1.0

## 选型

先判断是否需要软件。静态内容/一次性交付可直接使用 HTML、CSS、JavaScript，写明原因即可，不必套模板。

- web-app：需要服务端接口的 Web 产品；Next.js、React、TypeScript、Tailwind，普通 API 放在同一工程。
- lite-app：浏览器交互、看板或本地 UI；React、Vite、TypeScript、Tailwind，默认无后端。
- Python：文档处理、数据分析、模型实验或已有引擎复用；有独立 HTTP 消费者时才引入 FastAPI。普通模型 API 调用不是增加第二语言的理由。
- 微信小程序、浏览器扩展、用户指定的平台及学习目的属于明确例外，使用对应原生技术并在项目说明中记录。

## 持久化与服务

默认不安装数据库。单机持久化优先 SQLite；多实例/托管/较高并发写入优先 PostgreSQL；TypeScript 数据访问优先 Drizzle。SQLite 要有持久磁盘与备份，不默认适用于无持久磁盘的函数环境。
登录、支付、邮件按目标用户、部署环境与现有账号选定后复用，不预装。无登录的本地模板不能直接视作具备公网安全能力。

## 版本与扩展

固定 npm、直接依赖版本及锁文件；使用 Node.js 24 LTS 当前维护补丁，模板 .nvmrc 固定主版本。运行兼容性以 VALIDATION.md 的实际版本为准。
例行维护时检查官方支持与安全公告；版本核查时间不等于安全保证，不把版本永久冻结。

新增重要依赖在 tech-profile.json 的 exceptions 添加 {"dependency":"依赖名称","reason":"具体用途及代价"}。同时更新 storage/runtime/python，并执行正常的依赖安装和相关验证。
新增子工程使用 workspace:相对目录（如 workspace:backend）记录理由。普通业务依赖不强制逐个审批。标准条件内直接执行用户已授权的开发。
Python 工具脚本同样记录 python.enabled=true 和用途；项目依赖使用 pyproject.toml 与可复现锁文件，纯标准库脚本可以不引入包管理工具。

## 检查边界

check-stack 是轻量一致性检查，不是安全扫描或强制隔离：识别常见框架/存储/服务依赖，检查根锁文件、严格模式、配套版本和未登记的 Python/子工程；不能识别所有动态加载代码或全部依赖类别。
真实业务质量、隐私、认证、备份和浏览器表现仍需按需求验证。不要建立与项目风险不相称的审批流程。

## 来源（2026-09-06 核查）

- [Next.js 安装](https://nextjs.org/docs/app/getting-started/installation)
- [Next.js 服务端接口边界](https://nextjs.org/docs/app/guides/backend-for-frontend)
- [Vite 起步与运行环境](https://vite.dev/guide/)
- [Tailwind Vite 接入](https://tailwindcss.com/docs/installation/using-vite)
- [ESLint 支持周期](https://eslint.org/version-support/)
- [SQLite 适用范围](https://www.sqlite.org/whentouse.html)

具体 npm 版本查询后写入模板，未用 latest、beta 或 canary 作为默认依赖范围。TypeScript 采用已有项目常用的 5.9.3，并验证与当前依赖兼容，不因 latest 已升级主版本就自动跟随。

## ESLint 配套决定

统一 ESLint 10 与 TypeScript/React Hooks 规则；Web 模板使用与 Next.js 同版本的官方 @next/eslint-plugin-next。当前 eslint-config-next 间接包含不支持 ESLint 10 的插件，因此采用官方支持的直接插件接入方式，不强制覆盖 peerDependencies。浏览器验证单独检查基本标签与布局，未声称覆盖完整无障碍规则。

来源：[Next.js 直接接入 ESLint 插件](https://nextjs.org/docs/app/api-reference/config/eslint#using-the-plugin-directly)。
