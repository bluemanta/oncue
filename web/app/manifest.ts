import type { MetadataRoute } from 'next';

/**
 * 「添加到主屏幕」用的清单。
 *
 * 不提供这个和图标文件时，iOS 会拿标题首字母自动凑一个黑底白字的图标（IFM-190）。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'OnCue单词',
    short_name: 'OnCue',
    description: '遇到生词，丢进来。一次拿到意思、读音和例句，再跟读一遍看读得对不对。',
    start_url: '/',
    display: 'standalone',
    background_color: '#F5F2EA',
    theme_color: '#F5F2EA',
    lang: 'zh-CN',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
