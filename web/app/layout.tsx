import type { Metadata, Viewport } from 'next';
import { Fraunces, Noto_Sans } from 'next/font/google';
import './globals.css';

const fraunces = Fraunces({ subsets: ['latin'], display: 'swap', variable: '--font-fraunces' });
const notoSans = Noto_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-noto-sans' });

export const metadata: Metadata = {
  title: 'OnCue单词',
  description: '遇到生词，丢进来。一次拿到意思、读音和例句，再跟读一遍看读得对不对。',
  appleWebApp: { capable: true, title: 'OnCue单词', statusBarStyle: 'default' },
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
