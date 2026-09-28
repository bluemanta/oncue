# OnCue单词

遇到一个不会读的英文单词，丢进来，一次拿到意思、读音、例句，然后读给它听，它告诉你读对了没有、哪个音读偏了。

面向中国大陆用户的手机网页，可以"添加到主屏幕"像 App 一样打开。

线上：<https://oncue.imalltrix.com>

## 快速开始

```sh
npm --prefix web ci          # 装依赖
cp web/.env.example web/.env.local   # 填腾讯云的密钥，见文件里的注释
npm --prefix web run dev     # http://127.0.0.1:3000
```

其它命令和目录职责见 [CLAUDE.md](CLAUDE.md)，那份是这个仓库里最全的上手说明。

## 文档

| 文件 | 内容 |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | 项目说明：技术栈、目录、开发命令、已定下的约束、开发中调整过的决定 |
| [docs/PRD.md](docs/PRD.md) | 产品需求文档，需求的唯一依据 |
| [docs/产品说明.md](docs/产品说明.md) | 对外介绍：初衷、目标人群、现在能做什么 |
| [docs/GTM.md](docs/GTM.md) | 推广方案：定位、话术、渠道、分三波的节奏 |
| [docs/试点前置清单.md](docs/试点前置清单.md) | 推广前必须补的缺陷，分 A/B/C 三级 |
| [docs/部署方案.md](docs/部署方案.md) | 服务器现状、部署步骤、验证清单、四级回滚 |
| [docs/发音测试词表.md](docs/发音测试词表.md) | 选发音评测服务商用的 20 个常错词 |
| [docs/20词核对清单.md](docs/20词核对清单.md) | 上面那 20 个词的盲读核对清单 |
| [docs/微信录音测试清单.md](docs/微信录音测试清单.md) | 微信内置浏览器能不能录音的真机测试步骤 |
| [design/](design/) | 三屏设计稿源文件（来自设计工具，不能直接运行，只作参考） |

## 技术

Next.js + React + TypeScript + Tailwind，代码都在 `web/` 下。释义和例句用腾讯云 LKEAP 上的 DeepSeek，读音用腾讯云语音合成（合成结果存 COS 复用），发音评测用腾讯云智聆口语评测。三者都通过 `web/lib/` 下的一层统一接口调用，换服务商只改那一层。

第一版没有数据库，查词记录存在用户自己的手机上。

## 部署

本地构建 → 打包上传 COS → 服务器下载，通过腾讯云 TAT 远程执行，不走 GitHub。详见 [docs/部署方案.md](docs/部署方案.md)。

```sh
node deploy/build-and-upload.mjs                    # 构建、打包、上传
bash deploy/run-app-step.sh                         # 发布并重启服务
python3 deploy/remote.py deploy/steps/verify.sh     # 验收（含现有站点没被搞坏）
```

**改服务器上的任何东西之前先问项目负责人。** 同一台机器上还跑着另外四个站点。
