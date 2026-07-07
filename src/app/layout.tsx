import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'toss calendar — 모두를 생각한 시간',
  description: '동료들의 상황을 읽고, 모두가 괜찮은 시간을 찾아드려요',
  openGraph: {
    title: 'toss calendar — 모두를 생각한 시간',
    description: '동료들의 상황을 읽고, 모두가 괜찮은 시간을 찾아드려요',
    siteName: 'toss calendar',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: '/toss-symbol.png', width: 2000, height: 2000 }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        {/* Toss Product Sans (한글) — 토스 공식 CDN. Display Sans는 /fonts에 셀프 호스팅 */}
        <link rel="stylesheet" href="https://static.toss.im/tps/main.css" />
        <link rel="stylesheet" href="https://static.toss.im/tps/others.css" />
        <link
          rel="preload"
          href="/fonts/TossDisplaySansVariable.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
      </head>
      <body className="bg-bg text-text-strong antialiased">{children}</body>
    </html>
  );
}
