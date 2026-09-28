import type { MetadataRoute } from 'next';

/**
 * 爬虫规则。
 *
 * 首页可以被收录，`/result` 一定不能：它是普通 GET 地址，爬虫每抓一次
 * 就触发一次大模型调用，等于替我们花钱。接口同理。
 * 结果页自己还带了 noindex（见 result/page.tsx），双保险。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/result', '/api/'],
      },
    ],
  };
}
