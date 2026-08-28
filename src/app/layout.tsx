import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CodeLooter — Ekstraksi kode presisi dari modul praktikum",
  description:
    "Ekstrak code block dari PDF, Markdown, IPYNB, HTML, dan LaTeX secara presisi. Phase 1: merge blok terpotong, filter narasi, repair line-wrap, strip R-output.",
  keywords: [
    "CodeLooter", "ekstraksi kode", "PDF", "R", "modul praktikum",
    "code extractor", "pattern extraction",
  ],
  authors: [{ name: "CodeLooter" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "CodeLooter",
    description: "Ekstraksi kode presisi dari modul praktikum & paper akademik",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
