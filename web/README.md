# 新项目

来自 project-starter 0.1.0 / web-app。项目名、选型原因与技术例外见 tech-profile.json。

## 开始

使用 Node.js 24 LTS（有 nvm 时执行 `nvm use`），运行 `npm ci`，然后 `npm run dev`。默认只监听本机；以终端输出的实际地址为准，端口冲突先检查占用者。

- `npm run check`：技术栈、TypeScript 和 ESLint。
- `npm run build`：构建。
- `npm run start`：构建后运行生产服务。

本模板带一个 /api/items 示例接口，做输入验证并返回条目，不保存。 页面清单在刷新后重置。初始无数据库、登录、支付、邮件或外部模型调用。

## 首次验收

打开页面 → 输入“完成第一次验证” → 添加 → 勾选 → 显示“已完成 1 / 1”；在手机尺寸下检查没有横向溢出。修改相关功能后复验。真实持久化、认证或公网部署应按新增需求单独验证。

## 后续开发

先读 AGENTS.md、STACK.md；业务扩展应更新 tech-profile.json。凭证使用 .env.local，私人数据使用 data/ 或仓库外目录，并落实备份。模板更新不自动覆盖本项目。
