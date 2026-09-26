import type { NextConfig } from 'next';

const config: NextConfig = {
  turbopack: { root: process.cwd() },
  // 部署用：只打包真正用到的文件和依赖，服务器上不需要 npm install
  output: 'standalone',
};

export default config;
