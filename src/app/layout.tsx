import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { THEME_INIT_SCRIPT } from "@/lib/theme/init-script";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/seo/site";
import { siteMetadataBase } from "@/lib/share/share-metadata";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  ...(siteMetadataBase() ? { metadataBase: siteMetadataBase() } : {}),
  title: { default: SITE_TITLE, template: "%s" },
  description: SITE_DESCRIPTION,
  // PWA：iPhone 需「加入主畫面」後才能收 Web Push
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "散場誌", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  // 與 manifest 一致：theme ink-900；系統深色時用放映廳底 screen-950
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1f1c19" },
    { media: "(prefers-color-scheme: dark)", color: "#141110" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // data-theme 由 inline script 在首屏前寫入，伺服器端不知道，故略過該屬性的 hydration 比對
    <html lang="zh-Hant" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
