import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: '新的开始', description: '从一件小事开始。' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="zh-CN"><body>{children}</body></html>; }
