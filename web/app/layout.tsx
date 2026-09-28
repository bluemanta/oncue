import type { Metadata, Viewport } from 'next';
import { Fraunces, Noto_Sans } from 'next/font/google';
import './globals.css';

const fraunces = Fraunces({ subsets: ['latin'], display: 'swap', variable: '--font-fraunces' });
const notoSans = Noto_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-noto-sans' });

const TITLE = 'OnCue单词';
const DESCRIPTION = '遇到生词，丢进来。一次拿到意思、读音和例句，再跟读一遍看读得对不对。';

export const metadata: Metadata = {
  // 分享出去时要拼绝对地址，没有这一行 og:image 会是相对路径，微信读不到
  metadataBase: new URL('https://oncue.imalltrix.com'),
  title: TITLE,
  description: DESCRIPTION,
  appleWebApp: { capable: true, title: TITLE, statusBarStyle: 'default' },
  /**
   * 分享到微信、群里时的卡片。没有这些的话，发出去只有一个光秃秃的网址。
   * 图先用应用图标顶着；正经的 1200×630 分享图属于推广素材包（IFM-209）。
   */
  openGraph: {
    type: 'website',
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
    url: '/',
    locale: 'zh_CN',
    images: [{ url: '/icon-512.png', width: 512, height: 512, alt: TITLE }],
  },
  twitter: {
    card: 'summary',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/icon-512.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#F5F2EA',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={`${fraunces.variable} ${notoSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
