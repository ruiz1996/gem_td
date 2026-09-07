import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '宝石 TD · 迷宫实验室',
  description: '随机选石，构筑迷宫。适合手机的单人宝石塔防。',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="dark">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0c131d" />
      </head>
      <body>{children}</body>
    </html>
  );
}
