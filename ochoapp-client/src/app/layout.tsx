import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import "./gradients.css";
import "./globals.css";
import ReactQueryProvider from "./ReactQueryProvider";
import { NextSSRPlugin } from "@uploadthing/react/next-ssr-plugin"
import { extractRouterConfig } from "uploadthing/server";
import { fileRouter } from "./api/uploadthing/core";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

const emojiFont = localFont({
  src: "./fonts/Emoji.ttf",
  variable: "--font-emoji",
  preload: true,
  display: 'swap',
});

export const isXmas = (): boolean => {
  const today = new Date();
  const start = new Date(today.getFullYear(), 11, 24); // 24 décembre
  const end = new Date(today.getFullYear() + 1, 0, 2, 23, 59, 59); // 2 janvier inclus

  return today >= start && today <= end;
};

const favicons = isXmas()
  ? [
      { url: '/favicon-xmas.svg', type: 'image/svg+xml' },
      { url: '/favicon-xmas.ico', type: 'image/x-icon' },
      { url: '/favicon-xmas.png', type: 'image/png' },
    ]
  : [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/favicon.png', type: 'image/png' },
    ];

export const metadata: Metadata = {
  title: {
    template: "%s - OchoApp",
    default: "OchoApp"
  },
  description: "The social media app for power nerd", 
  icons: {
    icon: favicons,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning={true}>
      <body className={`${geistSans.variable} ${geistMono.variable} ${emojiFont.variable}`}>
        <NextSSRPlugin routerConfig={extractRouterConfig(fileRouter)}/>
        <ReactQueryProvider>
          <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          >
            {children}
          </ThemeProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
